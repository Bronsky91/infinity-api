require('dotenv').config();

const express = require("express");
const path = require("path");
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

mongoose.connect(MONGO_CONNECTION_STRING).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

const emailSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  }
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
    attachment: path.join(__dirname, filePath)
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
  res.send("Hello World!");
});

app.post('/sendmap', (req, res) => {
  const email = req?.body?.email;

  if (email) {
    saveEmail(email)
    sendMail(email, 'map.jpeg');
    res.status(200).send({ message: "Email sent successfully!" });
  } else {
    res.status(400).send({ error: "Email is required" });
  }
})


app.get("/download", async (req, res) => {
  const pythonInterpreter = path.join(__dirname, `../../Mythical_Maps/venv/Scripts/python.exe`);
  const scriptPath = path.join(__dirname, `../../Mythical_Maps/dungeon/rd_dungeon.py`);
  const outputDir = path.join(__dirname, `../../Mythical_Maps/dungeon/finished/`);
  const options = { cwd: path.dirname(scriptPath) };

  // Run the Python script as a child process
  exec(`${pythonInterpreter} ${scriptPath}`, options, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing Python script: ${error.message}`);
      return res.status(500).send("Error occurred while generating the map");
    }

    const filename = stdout.trim();

    // stdout should contain the path to the generated file
    const generatedFilePath = outputDir + filename;

    // Check if the file exists
    if (fs.existsSync(generatedFilePath)) {
      // Send the file to the client
      res.download(generatedFilePath, filename, (err) => {
        if (err) {
          console.error("Error occurred while downloading the file:", err);
          return res.status(500).send("Error occurred while downloading the file");
        }
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
