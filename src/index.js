require("dotenv").config();

const express = require("express");
const path = require("path");
const os = require("os");
const cors = require("cors");
const mongoose = require("mongoose");
const mailgun = require("mailgun-js");
const { exec } = require("child_process");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

const { GENERATOR } = require("./constants");
const {
  getScriptPathFromGenerator,
  azDateTime,
  getParams,
  outputDir,
  deleteFiles,
} = require("./utils");

const API_KEY = process.env.API_KEY;
const DOMAIN = process.env.DOMAIN;
const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;

// TODO: Update cors to only accept requests from WP site and new React app
app.use(cors());
app.use(express.json());

app.use(express.static("public"));
// Hosting the React App
app.use(express.static(path.join(__dirname, "../public/react-app")));

mongoose
  .connect(MONGO_CONNECTION_STRING)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });

const pythonInterpreter =
  os.platform() === "win32"
    ? path.join(__dirname, "../../Mythical_Maps/venv/Scripts/python.exe")
    : path.join(__dirname, "../../Mythical_Maps/venv/bin/python");

const emailSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  signupDatetime: {
    type: Date,
    default: () => azDateTime(),
  },
});

emailSchema.pre("save", function (next) {
  this.signupDatetime = () => azDateTime();
  next();
});

const Email = mongoose.model("Email", emailSchema);

const saveEmail = async (email) => {
  try {
    const existingEmail = await Email.findOne({ email });
    if (!existingEmail) {
      const newEmail = new Email({ email });
      await newEmail.save();
    }
  } catch (error) {
    console.error("Error saving email to MongoDB:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
};

const sendMail = (email, filePath) => {
  const mg = mailgun({ apiKey: API_KEY, domain: DOMAIN });

  const data = {
    from: "Arcane Collector <info@infinity.arcanecollector.com>",
    to: email,
    subject: "Welcome to Arcane Collector!",
    template: "fan fusion generated map",
    attachment: filePath,
  };

  // Send the email
  mg.messages().send(data, function (error, body) {
    if (error) {
      console.log("Error:", error);
    } else {
      console.log("Email sent:", body);
    }
  });
};

app.post("/sendmap", (req, res) => {
  const { email, filename } = req?.body;
  if (email) {
    saveEmail(email);
    sendMail(email, outputDir + filename);
    res.status(200).send({ message: "Email sent successfully!" });
  } else {
    res.status(400).send({ error: "Email is required" });
  }
});

// Wordpress Prototype endpoint
app.get("/generate", async (req, res) => {
  const {
    type,
    size,
    grid,
    theme,
    layout,
    time_of_day,
    season,
    middle_event,
    center,
    road_to_tavern,
  } = req.query;

  const scriptPath = getScriptPathFromGenerator(type);
  let params = "";

  if (grid && grid !== "none") {
    params += ` --grid_type ${grid}`;
  }

  switch (type) {
    case GENERATOR.DUNGEON:
      if (theme) {
        params += ` --tileTheme ${theme}`;
      }
      if (size) {
        params += ` --tileCount ${size}`;
      }
      if (layout) {
        params += ` --tileGenInput ${layout}`;
      }
      break;
    case GENERATOR.TAVERN:
      if (time_of_day) {
        params += ` --time_of_day ${time_of_day}`;
      }
      if (season) {
        params += ` --season ${season}`;
      }
      break;
    case GENERATOR.ROAD:
      if (size) {
        params += ` --length ${size}`;
      }
      if (middle_event === "true") {
        params += ` --middle_event`;
      }
      if (road_to_tavern === "true") {
        params += ` --tavern`;
      }
      break;
    case GENERATOR.WILDERNESS:
      if (size) {
        let wildernessSize;
        if (size == 3) {
          wildernessSize = "small";
        } else if (size == 5) {
          wildernessSize = "medium";
        } else if (size == 7) {
          wildernessSize = "large";
        }
        params += ` --size ${wildernessSize}`;
      }
      if (center) {
        params += ` --center ${center}`;
      }
      break;
    default:
      // Nothing was enter, default to basic dungeon
      if (size) {
        params += ` --tileCount ${size}`;
      }
      break;
  }

  const options = { cwd: path.dirname(scriptPath) };

  console.log("RUNNING", `${pythonInterpreter} ${scriptPath} ${params}`);

  // Run the Python script as a child process
  exec(
    `${pythonInterpreter} ${scriptPath} ${params}`,
    options,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing Python script: ${error.message}`);
        return res.status(500).send("Error occurred while generating the map");
      }

      let filename;

      if (type === GENERATOR.DUNGEON || !type) {
        const data = JSON.parse(stdout);
        filename = data.player_filename;
      } else {
        filename = stdout.trim();
      }

      // stdout should contain the path to the generated file
      const generatedFilePath = outputDir + filename;

      // Check if the file exists
      if (fs.existsSync(generatedFilePath)) {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.setHeader("Filename", filename);

        // Send the file to the client
        res.download(generatedFilePath, filename, (err) => {
          if (err) {
            console.error("Error occurred while sending the file:", err);
            return res
              .status(500)
              .send("Error occurred while sending the file");
          }

          // Schedule file deletion after 5 minutes
          setTimeout(() => {
            fs.unlink(generatedFilePath, (err) => {
              if (err) {
                console.error("Error occurred while deleting the file:", err);
              } else {
                console.log(`File ${filename} deleted successfully`);
              }
            });
          }, 5 * 60 * 1000); // 5 minutes in milliseconds
        });
      } else {
        console.error("Generated file not found:", generatedFilePath);
        res.status(500).send("Generated file not found");
      }
    }
  );
});

// * Generate Endpoint will create the Map files, and PDF and return the JSON data of DM Guide along with the filenames
// TODO: Create a refactored /download endpoint that uses the filenames from the /generate endpoint to download the files
app.post("/generate", (req, res) => {
  const { generator } = req.body;

  const scriptPath = getScriptPathFromGenerator(generator);
  const params = getParams(req.body);

  const options = { cwd: path.dirname(scriptPath) };

  console.log("RUNNING", `${pythonInterpreter} ${scriptPath} ${params}`);

  // Run the Python script as a child process
  exec(
    `${pythonInterpreter} ${scriptPath} ${params}`,
    options,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing Python script: ${error.message}`);
        return res.status(500).send("Error occurred while generating the map");
      }

      let mapData;
      if (generator === GENERATOR.DUNGEON) {
        mapData = JSON.parse(stdout);
      } else {
        mapData = stdout.trim();
      }

      console.log("mapData", mapData);

      // Schedule file deletion after 5 minutes
      setTimeout(
        () => {
          const files =
            generator === GENERATOR.DUNGEON
              ? [
                  mapData.player_filename,
                  mapData.dm_filename,
                  mapData.pdf_filename,
                ]
              : [mapData];
          deleteFiles(files);
        },
        5 * 60 * 1000 // 5 minutes in milliseconds
      );

      res.send(mapData);
    }
  );
});

app.get("/download", async (req, res) => {
  const { filename } = req.query;
  const generatedFilePath = outputDir + filename;

  // Check if the file exists
  if (fs.existsSync(generatedFilePath)) {
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Filename", filename);

    // Send the file to the client
    res.download(generatedFilePath, filename, (err) => {
      if (err) {
        console.error("Error occurred while sending the file:", err);
        return res.status(500).send("Error occurred while sending the file");
      }
    });
  } else {
    console.error("Generated file not found:", generatedFilePath);
    res.status(500).send("Generated file not found");
  }
});

app.listen(port, () => {
  console.log(`Infinity api listening at http://localhost:${port}`);
});
