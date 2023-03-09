import mysql from 'mysql2'

const config = {
  host: "localhost",
  port: "3030",
  database: "drcuidado_old",
  user: "root",
  password: ""
}

export const connection = mysql.createConnection(config)

connection.connect((err)=>{
  if(err) return console.log(err.message)
  return console.log("------------Database connected--------------")
})