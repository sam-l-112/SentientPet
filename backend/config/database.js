const mariadb = require("mariadb")

const pool = mariadb.createPool({

host:"localhost",

user:"appuser",

password:"password",

database:"logindb",

connectionLimit:5

})

module.exports = pool