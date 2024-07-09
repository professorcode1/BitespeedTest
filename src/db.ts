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
function sort_the_contact_entities(left:TContactBase, right:TContactBase):number{
    if(left.createdAt < right.createdAt) return -1;
    if(left.createdAt > right.createdAt) return 1;
    return 0;
}
async function insert_secondary_into_db_and_get_result(req_body:TRequestBody):Promise<TIdentifyResult>{
    const contact_data = await get_all_assosiated_contacts_for_this_entity(req_body);
    const latest_contact = contact_data.sort(sort_the_contact_entities)[contact_data.length-1]
    const {insertId} = await async_push_query("insert into contact set ?", {...req_body, linkedId:latest_contact.id, linkPrecedence:"secondary"} as TContactBase, db_connection);
    const result = transform_raw_db_data_to_result(contact_data);
    result.contact.emails = [...result.contact.emails, ...array_from_nullable_element(req_body.email)];
    result.contact.phoneNumbers = [...result.contact.phoneNumbers, ...array_from_nullable_element(req_body.phoneNumber)];
    result.contact.secondaryContactIds = [...result.contact.secondaryContactIds, insertId]
    return result;
}
async function merge_the_two_lists_and_return_result(left_list:TContactBase[], right_list:TContactBase[]):Promise<TIdentifyResult>{
    const new_list = [...left_list, ...right_list];
    new_list.sort(sort_the_contact_entities);
    const entry_needing_precedence_update = new_list.map((e,i)=>[e,i] as [TContactBase, number]).find(([e,i])=>e.linkPrecedence === "primary" && i>0)![0].id!;
    let update_transaction = `
        UPDATE contact SET linkPrecedence  = 'secondary',updatedAt = CURRENT_TIMESTAMP  WHERE id = ${entry_needing_precedence_update};
    `;
    for(let i =1 ; i<new_list.length ; i++){
        if(new_list[i].linkedId === new_list[i-1].id) continue;
        update_transaction += `
            UPDATE contact SET linkedId = ${new_list[i-1].id} WHERE id = ${new_list[i].id};
        `;
        new_list[i].linkedId = new_list[i-1].id;
    }
    db_connection.beginTransaction((error)=>{
        if(error) throw error;
        async_get_query(update_transaction, db_connection);
        db_connection.commit((error)=>{
            if(!Boolean(error)) return ;
            return db_connection.rollback(()=>{throw error;});
        })
    })
    return transform_raw_db_data_to_result(new_list);
}

export {
    db_connection, 
    get_contact_metadata, 
    get_all_assosiated_contacts_for_this_entity, 
    async_push_query,
    insert_primary_into_db_and_get_result,
    transform_raw_db_data_to_result,
    insert_secondary_into_db_and_get_result,
    merge_the_two_lists_and_return_result
}
export type {TRequestBody, TIdentifyResult, TContactMetadata};