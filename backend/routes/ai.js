const express = require("express")
const router = express.Router()
const aiController = require("../controllers/aiController")
const authMiddleware = require('../middleware/authMiddleware')

// ==== AI ====
router.post('/ask', aiController.askAI)

// === chat test ===
// router.post('/chat',            authMiddleware, aiController.chat)

// ==== sessions ===
router.post('/sessions',         authMiddleware, aiController.createSession)
router.get('/sessions',         authMiddleware, aiController.getSessions)

// ==== messages ===
router.post('/sessions/:cs_id/messages',        authMiddleware, aiController.chat)
router.get('/sessions/:cs_id/messages',        authMiddleware, aiController.getHistory)
// router.get('/history/:cs_id',   authMiddleware, aiController.getHistory)

module.exports = router