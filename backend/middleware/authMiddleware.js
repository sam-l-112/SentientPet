const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1] // Bearer <token>

    if (!token) {
        return res.status(401).json({ message: '請先登入' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded // 後面 controller 可以用 req.user.user_id
        next()
    } catch (err) {
        return res.status(403).json({ message: 'Token 無效或已過期' })
    }
}