import mysql from 'mysql2'

const config = {
  host: "localhost",
  port: "3306",
  database: "drcuidadosaude",
  user: "hermes",
  password: "awsx1215"
}

export const connection = mysql.createConnection(config)

connection.connect((err)=>{
  if(err) return console.log('Database error',err.message)
  return console.log("------------Database connected--------------")
})