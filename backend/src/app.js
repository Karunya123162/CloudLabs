const express = require('express')
const cors = require('cors')

const app = express()

app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', require('./routes/authRoutes'))
app.use('/api/aws',  require('./routes/awsRoutes'))

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

module.exports = app
