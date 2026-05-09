const express = require("express")
const router = express.Router()
const saController = require("../controllers/saController")


// === Sentiment_analysisy ===
router.post('/sa')
router.get('/sa')

// === Emotional Tracking ===
router.post('/et')
