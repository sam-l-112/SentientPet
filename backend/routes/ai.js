const express = require("express")
const router = express.Router()
const aiController = require("../controllers/aiController")
const authMiddleware = require('../middleware/authMiddleware')

router.post('/ask', aiController.askAI)

router.post('/session',         authMiddleware, aiController.createSession)
router.get('/sessions',         authMiddleware, aiController.getSessions)
router.post('/chat',            authMiddleware, aiController.chat)
router.get('/history/:cs_id',   authMiddleware, aiController.getHistory)

module.exports = router