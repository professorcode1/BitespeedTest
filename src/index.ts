import { configure_dotnev } from './configure_dotenv';
configure_dotnev()
var cors = require('cors');
import express from 'express';
import bodyParser from "body-parser";
import { async_push_query, db_connection, get_all_assosiated_contacts_for_this_entity, get_contact_metadata, insert_primary_into_db_and_get_result, insert_secondary_into_db_and_get_result, TIdentifyResult, transform_raw_db_data_to_result, TRequestBody } from './db';


const app = express();
const port = 3000;
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors({
    credentials: true,
    origin: "*",
    methods: ["POST", "PUT", "GET", "OPTIONS", "HEAD"],
}));




app.post('/bitspeedtest/identify', async (req, res) => {
  const req_body:TRequestBody = req.body;
  if(req_body.email === undefined && req_body.phoneNumber === undefined){
    return res.status(400).send();
  }
  for(const key of Object.keys(req_body)){
    if(key !== "email" && key !== "phoneNumber"){
      return res.status(400).send()
    }
  }
  const contact_metadata = await get_contact_metadata(req_body);
  const contact_doesnt_exist = contact_metadata.length === 0;
  if(contact_doesnt_exist){
    const result = await insert_primary_into_db_and_get_result(req_body);
    return res.send(result);
  }
  const exact_entry_exists = contact_metadata.filter(
    x => x.BothMatch === 1
  ).length > 0;
  if(exact_entry_exists){
    const result:TIdentifyResult = transform_raw_db_data_to_result( await get_all_assosiated_contacts_for_this_entity(req_body));
    return res.send(result);
  }
  const phone_numbers_matched = contact_metadata.filter(
    x => x.NumberMatch === 1
  ).length > 0;
  const emails_matched = contact_metadata.filter(
    x => x.MailMatch === 1
  ).length > 0;
  if(!(phone_numbers_matched && emails_matched) ){
    //one of them matches but not the other
    const result = await insert_secondary_into_db_and_get_result(req_body);
    return res.send(result);
  }
  //there are 2 seperate lists, one via the email and one via the phone number. 
  //Since no "new" information has been encountered no new record will be made
  //but if there 2 lists are not attached then they need to be attached

  res.send('Hello World!');
});

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});