import mysql,{ Connection } from "mysql"
const util = require('util');

function async_push_query(sql_query:string, info:Object, connection:Connection) {
    return util.promisify(connection.query).call(connection, sql_query, info);
}


function async_get_query(sql_query:string, connection:Connection) {
    return util.promisify(connection.query).call(connection, sql_query);
}

const DBConfig = {
    host     : process.env.DBHOST,
    port     : Number(process.env.DBPORT),
    user     : process.env.DBUSER,
    password : process.env.DBPASS,
    database : process.env.bitespeeddbname
}
const db_connection = mysql.createConnection(DBConfig);
type TRequestBody = {
    email?:string
    phoneNumber?:string
  }

type TContactMetadata = {
    row_count:number
    BothMatch:number
    MailMatch:number
    NumberMatch:number
}
async function get_contact_metadata(req_body:TRequestBody):Promise<TContactMetadata[]>{
    return (await async_get_query(
        `CALL get_contact_metadata
        (${ db_connection.escape(req_body.email)}, ${ db_connection.escape(req_body.phoneNumber)})`, 
        db_connection
    ))[0];
}

type TContactBase = {
    id:number
    phoneNumber:string|null
    email:string|null,
    createdAt:Date,
    updatedAt: Date,
    deletedAt:Date|null
}
&(
    {
        linkedId:null,
        linkPrecedence:'primary',
    } | {
        linkedId:number,
        linkPrecedence:'secondary',
    }
)

async function get_all_assosiated_contacts_for_this_entity(req_body:TRequestBody):Promise<TContactBase[]>{
    return (await async_get_query(
        `CALL get_all_assosiated_contacts_for_this_entity
        (${ db_connection.escape(req_body.email)}, ${ db_connection.escape(req_body.phoneNumber)})`, 
        db_connection
    ))[0];
}
type TIdentifyResult = {
    contact:{
        primaryContatctId:number,
        emails:string[],
        phoneNumbers:string[],
        secondaryContactIds:number[]
    }
}
function transform_raw_db_data_to_result(raw_data:TContactBase[]):TIdentifyResult{
    const primary_element = raw_data.find(x => x.linkPrecedence === "primary");
    if(primary_element === undefined){
        throw Error("no primary element found in contact data, erroring now");
    }
    return {
        contact:{
            primaryContatctId:primary_element.id, 
            emails:raw_data.map(x => x.email).filter(x => x !== null), 
            phoneNumbers:raw_data.map(x => x.phoneNumber).filter(x => x !== null), 
            secondaryContactIds:raw_data.map(x => x.id).filter(x=> x !== primary_element.id)
        }
    }
}
function array_from_nullable_element<T>(x:T|undefined|null){
    if(x === null || x === undefined)return [];
    return [x];
}
async function insert_primary_into_db_and_get_result(req_body:TRequestBody):Promise<TIdentifyResult>{
    const {insertId}:{insertId:number} = await async_push_query("insert into contact set ?", req_body, db_connection);
    const result:TIdentifyResult = {
      contact:{
        primaryContatctId:insertId,
        emails:array_from_nullable_element(req_body.email),
        phoneNumbers:array_from_nullable_element(req_body.phoneNumber),
        secondaryContactIds:[]
      }
    }
    return result;
}

async function insert_secondary_into_db_and_get_result(req_body:TRequestBody):Promise<TIdentifyResult>{
    const contact_data = await get_all_assosiated_contacts_for_this_entity(req_body);
    const latest_contact = contact_data.sort((left, right)=>{
        if(left.createdAt < right.createdAt) return -1;
        if(left.createdAt > right.createdAt) return 1;
        return 0;
    })[contact_data.length-1]
    const {insertId} = await async_push_query("insert into contact set ?", {...req_body, linkedId:latest_contact.id, linkPrecedence:"secondary"} as TContactBase, db_connection);
    const result = transform_raw_db_data_to_result(contact_data);
    result.contact.emails = [...result.contact.emails, ...array_from_nullable_element(req_body.email)];
    result.contact.phoneNumbers = [...result.contact.phoneNumbers, ...array_from_nullable_element(req_body.phoneNumber)];
    result.contact.secondaryContactIds = [...result.contact.secondaryContactIds, insertId]
    return result;
}

export {
    db_connection, 
    get_contact_metadata, 
    get_all_assosiated_contacts_for_this_entity, 
    async_push_query,
    insert_primary_into_db_and_get_result,
    transform_raw_db_data_to_result,
    insert_secondary_into_db_and_get_result
}
export type {TRequestBody, TIdentifyResult};