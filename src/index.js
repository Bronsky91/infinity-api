require('dotenv').config();

const express = require("express");
const path = require("path");
const os = require('os');
const cors = require("cors");
const mongoose = require('mongoose');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

const mailgun = require('mailgun-js');
const API_KEY = process.env.API_KEY;
const DOMAIN = process.env.DOMAIN;
const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING

app.use(cors());
app.use(express.json());

app.use(express.static('public'));

mongoose.connect(MONGO_CONNECTION_STRING).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

const pythonInterpreter = os.platform() === 'win32'
  ? path.join(__dirname, '../../Mythical_Maps/venv/Scripts/python.exe')
  : path.join(__dirname, '../../Mythical_Maps/venv/bin/python');

const dungeonScriptPath = path.join(__dirname, `../../Mythical_Maps/dungeon/rd_dungeon_args.py`);
const roadScriptPath = path.join(__dirname, `../../Mythical_Maps/road/rd_road_args.py`);
const tavernScriptPath = path.join(__dirname, `../../Mythical_Maps/tavern/rd_tavern_args.py`);
const wildernessScriptPath = path.join(__dirname, `../../Mythical_Maps/wilderness/rd_wilderness_args.py`);

const outputDir = path.join(__dirname, `../../Mythical_Maps/finished/`);

const azDateTime = () => {
  const now = new Date();
  const utcNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  const arizonaTime = new Date(utcNow.getTime() - 7 * 60 * 60000); // UTC-7 for Arizona time
  return arizonaTime;
}

const emailSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  }, signupDatetime: {
    type: Date,
    default: () => azDateTime()
  }
});

emailSchema.pre('save', function (next) {
  this.signupDatetime = () => azDateTime();
  next();
});

const Email = mongoose.model('Email', emailSchema);

const saveEmail = async (email) => {
  try {
    const existingEmail = await Email.findOne({ email });
    if (!existingEmail) {
      const newEmail = new Email({ email });
      await newEmail.save();
    }
  } catch (error) {
    console.error('Error saving email to MongoDB:', error);
    res.status(500).send({ error: "Internal Server Error" });
  }
}

const sendMail = (email, filePath) => {
  const mg = mailgun({ apiKey: API_KEY, domain: DOMAIN });

  const data = {
    from: 'Arcane Collector <info@infinity.arcanecollector.com>',
    to: email,
    subject: 'Welcome to Arcane Collector!',
    template: 'fan fusion generated map',
    attachment: filePath
  };

  // Send the email
  mg.messages().send(data, function (error, body) {
    if (error) {
      console.log('Error:', error);
    } else {
      console.log('Email sent:', body);
    }
  });
}

app.get("/", (req, res) => {
  res.redirect('https://arcanecollector.com')
});

app.post('/sendmap', (req, res) => {
  const { email, filename } = req?.body

  if (email) {
    saveEmail(email)
    sendMail(email, outputDir + filename);
    res.status(200).send({ message: "Email sent successfully!" });
  } else {
    res.status(400).send({ error: "Email is required" });
  }
})


app.get("/download", async (req, res) => {
  const { type, size, grid, time_of_day, season, middle_event, center } = req.query;

  let scriptPath;
  let params = ''

  if (grid && grid !== 'none') {
    params += ` --grid_type ${grid}`;
  }

  switch (type) {
    case 'tavern':
      scriptPath = tavernScriptPath;
      if (time_of_day) {
        params += ` --time_of_day ${time_of_day}`
      }
      if (season) {
        params += ` --season ${season}`
      }
      break;
    case 'road':
      scriptPath = roadScriptPath;
      if (size) {
        params += ` --length ${size}`;
      }
      if (middle_event === 'true') {
        params += ` --middle_event`
      }
      break;
    case 'wilderness':
      scriptPath = wildernessScriptPath;
      if (size) {
        params += ` --size ${size}`;
      }
      if (center) {
        params += ` --center ${center}`
      }
      break;
    default:
      scriptPath = dungeonScriptPath;
      if (size) {
        params += ` --tileCount ${size}`;
      }
      break;
  }

  const options = { cwd: path.dirname(scriptPath) };

  console.log("RUNNING", `${pythonInterpreter} ${scriptPath} ${params}`);

  // Run the Python script as a child process
  exec(`${pythonInterpreter} ${scriptPath} ${params}`, options, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing Python script: ${error.message}`);
      return res.status(500).send("Error occurred while generating the map");
    }

    const filename = stdout.trim();

    // stdout should contain the path to the generated file
    const generatedFilePath = outputDir + filename;

    // Check if the file exists
    if (fs.existsSync(generatedFilePath)) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Filename', filename);

      // Send the file to the client
      res.download(generatedFilePath, filename, (err) => {
        if (err) {
          console.error("Error occurred while sending the file:", err);
          return res.status(500).send("Error occurred while sending the file");
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
  });
});

app.listen(port, () => {
  console.log(`Infinity api listening at http://localhost:${port}`);
});
