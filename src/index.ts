import { configure_dotnev } from './configure_dotenv';
configure_dotnev()
var cors = require('cors');
import express from 'express';
import bodyParser from "body-parser";
import { async_push_query, db_connection, get_all_assosiated_contacts_for_this_entity, get_contact_metadata, insert_primary_into_db_and_get_result, insert_secondary_into_db_and_get_result, merge_the_two_lists_and_return_result, TIdentifyResult, transform_raw_db_data_to_result, TRequestBody } from './db';


const app = express();
const port = 3000;
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));




app.post('/bitspeedtest/identify', async (req, res) => {
  const req_body:TRequestBody = req.body;
  if(req_body.email === undefined && req_body.phoneNumber === undefined){
    return res.status(400).send();
  }
  for(const key of Object.keys(req_body)){
    //extra layer of simple protection against sql injection 
    if(key !== "email" && key !== "phoneNumber"){
      return res.status(400).send()
    }
  }
  const contact_metadata = await get_contact_metadata(req_body);
  const contact_doesnt_exist = contact_metadata.length === 0;
  if(contact_doesnt_exist){
    const result:TIdentifyResult = await insert_primary_into_db_and_get_result(req_body);
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
    const result:TIdentifyResult = await insert_secondary_into_db_and_get_result(req_body);
    return res.send(result);
  }
  //there are 2 seperate lists, one via the email and one via the phone number. 
  //Since no "new" information has been encountered no new record will be made
  //but if there 2 lists are not attached then they need to be attached
  const email_based_entries = await get_all_assosiated_contacts_for_this_entity({email:req_body.email});
  const number_based_entries = await get_all_assosiated_contacts_for_this_entity({phoneNumber:req_body.phoneNumber});
  const primary_email_entry = email_based_entries.find(x => x.linkPrecedence === "primary");
  const primary_number_entry = number_based_entries.find(x => x.linkPrecedence === "primary");
  if(primary_email_entry === undefined) throw Error("Primary entry for email list doesn't exist");
  if(primary_number_entry === undefined) throw Error("Primary entry for number list doesn't exist");
  const both_lists_are_already_linked = primary_email_entry.id === primary_number_entry.id;
  if(both_lists_are_already_linked){
    const result:TIdentifyResult = transform_raw_db_data_to_result(email_based_entries);
    return res.send(result);
  } 
  const result = await merge_the_two_lists_and_return_result(email_based_entries, number_based_entries);
  return res.send(result);
});

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});