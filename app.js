require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const imageThumbnail = require("image-thumbnail");
const ObjectId = require("mongoose").Types.ObjectId;
var mongoose = require("mongoose");
mongoose.connect(process.env.MONGODB_CONNECTION_STRING, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const app = express();
app.use(function (req, res, next) {
  if (req.query.key === process.env.API_KEY) {
    next();
  } else {
    res.status(401).send();
  }
});
app.use(bodyParser.text({ limit: "20mb", extended: true }));

var db = mongoose.connection;
// Upon connection failure
db.on("error", console.error.bind(console, "Db Connection error:"));
// Upon opening the database successfully
db.once("open", function () {
  console.log("Db Connection is opened");
});

// MongoDB Schema
var Schema = mongoose.Schema;
var OCRResultSchema = mongoose.Schema({
  img: { type: Buffer, required: true },
  thumbnail: { type: Buffer, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, required: true, default: new Date() },
});
var OCRResult = mongoose.model("OCRResult", OCRResultSchema);

const thumbnailOption = {
  responseType: "base64",
};

async function getOcrResult(base64) {
  try {
    let res = await axios.post(
      "https://vision.googleapis.com/v1/images:annotate?key=" +
        process.env.GOOGLE_VISION_API_KEY,
      {
        requests: [
          {
            image: {
              content: base64,
            },
            features: [
              {
                type: "TEXT_DETECTION",
              },
            ],
          },
        ],
      }
    );
    return res.data.responses[0].fullTextAnnotation.text;
  } catch (err) {
    console.log(err);
    return null;
  }
}

app.post("/processImg", async function (req, res) {
  try {
    if (req.body && Object.keys(req.body).length !== 0) {
      let ocrResult = "123"; // await getOcrResult(req.body);
      if (ocrResult) {
        const thumbnail = await imageThumbnail(req.body, thumbnailOption);
        var newRecord = new OCRResult({
          img: req.body,
          thumbnail: thumbnail,
          text: ocrResult,
        });
        newRecord.save(function (err) {
          if (err) {
            res.status(500).send();
          } else {
            newRecord.img = null;
            res.send(newRecord);
          }
        });
      } else {
        res.status(500).send();
      }
    } else {
      res.status(400).send("Please provide image base64 string as text/plain");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send();
  }
});

app.get("/previousOcrResult", async function (req, res) {
  let result = await OCRResult.find({}, "_id thumbnail createdAt").exec();
  res.send(result);
});

app.get("/fullSizeImg", async function (req, res) {
  if (req.query.id) {
    if (ObjectId.isValid(req.query.id)) {
      let result = await OCRResult.findById(req.query.id, "img").exec();
      if (result) {
        res.send(result);
      } else {
        res.status(400).send("Provided id is not exist.");
      }
    } else {
      res.status(400).send("Provided id is not valid.");
    }
  } else {
    res.status(400).send("id is required.");
  }
});

var server = app.listen(process.env.PORT, function () {
  console.log("listening port %s", process.env.PORT);
});
