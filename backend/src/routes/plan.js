const express = require("express");
const router = express.Router();
const { getPlan } = require("../controllers/planController");

router.get("/", getPlan);

module.exports = router;
