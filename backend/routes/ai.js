const express = require("express")
const router = express.Router()
const aiController = require("../controllers/aiController")
const authMiddleware = require('../middleware/authMiddleware')

router.post('/ask', aiController.askAI)

router.post('/chat',            authMiddleware, aiController.chat)
router.post('/session',         authMiddleware, aiController.createSession)
router.get('/sessions',         authMiddleware, aiController.getSessions)
router.post('/session/:session_time/messages',        authMiddleware, aiController.chat)
router.get('/session/:session_time/messages',        authMiddleware, aiController.getHistory)
// router.get('/history/:cs_id',   authMiddleware, aiController.getHistory)

module.exports = router