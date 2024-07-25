require("dotenv").config();

const express = require("express");
const path = require("path");
const os = require("os");
const cors = require("cors");
const mongoose = require("mongoose");
const mailgun = require("mailgun-js");
const { exec } = require("child_process");
const fs = require("fs");
const crypto = require("crypto");
const bodyParser = require("body-parser");

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
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

// TODO: Update cors to only accept requests from WP site and new React app
app.use(cors());
app.use(express.json());

// Middleware to verify the GitHub webhook signature
const verifySignature = (req, res, buf) => {
  const secret = GITHUB_WEBHOOK_SECRET;
  const signature = req.headers["x-hub-signature"] || "";
  const hmac = crypto.createHmac("sha1", secret);
  hmac.update(buf, "utf-8");
  const expectedSignature = `sha1=${hmac.digest("hex")}`;

  if (signature !== expectedSignature) {
    throw new Error("Invalid signature.");
  }
};
const webhookBodyParser = bodyParser.json({ verify: verifySignature });

app.use(express.static("public"));
// Hosting the React App
app.use(express.static(path.join(__dirname, "../../infinity-ui/build")));

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

app.post("/webhook", webhookBodyParser, (req, res) => {
  const payload = req.body;

  console.log("Received Github webhook", payload.repository.name);

  if (
    payload.ref === "refs/heads/master" &&
    payload.repository.name === "infinity-ui"
  ) {
    // Pull the latest changes from the repository
    exec(
      "git pull && yarn install && yarn build",
      { cwd: path.join(__dirname, "../../infinity-ui") },
      (err, stdout, stderr) => {
        if (err) {
          console.error(`Error: ${stderr}`);
          console.log("Deployment failed.");
          return res.status(500).send("Deployment failed.");
        }
        console.log(`Output: ${stdout}`);
        console.log("Deployment successful.");
        res.status(200).send("Deployment successful.");
      }
    );
  } else {
    console.log("No deployment needed.");
    res.status(200).send("No deployment needed.");
  }
});

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
      const mapData = JSON.parse(stdout);
      console.log("MAP DATA", mapData);
      const filename = mapData.filenames.player;

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

      const mapData = JSON.parse(stdout);

      // Schedule file deletion after 5 minutes
      setTimeout(
        () => {
          const files = [mapData.player, mapData.dm, mapData.pdf];
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
