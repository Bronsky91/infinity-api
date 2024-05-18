const express = require("express");
const path = require("path");
const cors = require("cors");
const app = express();
const port = 3000;

app.use(cors());


function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/download", async (req, res) => {
  const filePath = path.join(__dirname, "map.jpeg");

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
