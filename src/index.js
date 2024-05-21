require('dotenv').config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require('mongoose');
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


const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    from: 'Arcane Collector <bronsky@infinity.arcanecollector.com>',
    to: email,
    subject: 'New Map Generated!',
    text: 'Testing some Mailgun awesomeness!',
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
  console.log('email', email)
  if (email) {
    saveEmail(email)
    sendMail(email, 'map.jpeg');
    res.status(200).send({ message: "Email sent successfully!" });
  } else {
    res.status(400).send({ error: "Email is required" });
  }
})

app.get("/download", async (req, res) => {
  const filePath = path.join(__dirname, "map.jpeg");
  // run a child process('python dbscript --name fartface') -> filename
  // get that file from the tmp dir by the filename, grab that, then send it to the website

  // Mocking the map generation process that may take a few seconds
  await delay(5000);

  res.download(filePath, "map.jpeg", (err) => {
    if (err) {
      console.error("Error occurred while downloading the file:", err);
      res.status(500).send("Error occurred while downloading the file");
    }
  });
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
