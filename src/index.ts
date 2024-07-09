require("dotenv").config();
var cors = require('cors');
import express from 'express';
import mysql from "mysql"
import bodyParser from "body-parser";


const app = express();
const port = 3000;
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors({
    credentials: true,
    origin: "*",
    methods: ["POST", "PUT", "GET", "OPTIONS", "HEAD"],
}));

type TRequestBody = {
  email?:string
  phoneNumber?:string
}
app.post('/bitspeedtest/identify', (req, res) => {
  const req_body:TRequestBody = req.body;
  if(req_body.email === undefined && req_body.phoneNumber === undefined){
    return res.status(400).send();
  }
// if input has only 1 field or exact record exists
// 	no change to db
// 	return the result json view
// if match with records exists but only due to email or only due to phone
// 	create a new record 
// 	return the result json view
// if a match with records exists via both email and phone
// 	if there records are already associated with each i.e. count of primary is 1 
// 		create a new record
// 		return the result json view
// 	else:
// 		change the primary with later creation date to secondary
// 		create a new record
// 		return the result json view
  res.send('Hello World!');
});

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});