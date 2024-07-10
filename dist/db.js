"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db_connection = void 0;
exports.get_contact_metadata = get_contact_metadata;
exports.get_all_assosiated_contacts_for_this_entity = get_all_assosiated_contacts_for_this_entity;
exports.async_push_query = async_push_query;
exports.insert_primary_into_db_and_get_result = insert_primary_into_db_and_get_result;
exports.transform_raw_db_data_to_result = transform_raw_db_data_to_result;
exports.insert_secondary_into_db_and_get_result = insert_secondary_into_db_and_get_result;
exports.merge_the_two_lists_and_return_result = merge_the_two_lists_and_return_result;
exports.number_of_rows = number_of_rows;
const mysql_1 = __importDefault(require("mysql"));
const util = require('util');
function async_push_query(sql_query, info, connection) {
    return util.promisify(connection.query).call(connection, sql_query, info);
}
function async_get_query(sql_query, connection) {
    return util.promisify(connection.query).call(connection, sql_query);
}
const DBConfig = {
    host: process.env.DBHOST,
    port: Number(process.env.DBPORT),
    user: process.env.DBUSER,
    password: process.env.DBPASS,
    database: process.env.bitespeeddbname
};
const db_connection = mysql_1.default.createConnection(DBConfig);
exports.db_connection = db_connection;
function get_contact_metadata(req_body) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield async_get_query(`CALL get_contact_metadata
        (${db_connection.escape(req_body.email)}, ${db_connection.escape(req_body.phoneNumber)})`, db_connection))[0];
    });
}
function onlyUnique(value, index, array) {
    return array.indexOf(value) === index;
}
function get_all_assosiated_contacts_for_this_entity(req_body) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield async_get_query(`CALL get_all_assosiated_contacts_for_this_entity
        (${db_connection.escape(req_body.email)}, ${db_connection.escape(req_body.phoneNumber)})`, db_connection))[0];
    });
}
function transform_raw_db_data_to_result(raw_data) {
    const primary_element = raw_data.find(x => x.linkPrecedence === "primary");
    if (primary_element === undefined) {
        throw Error("no primary element found in contact data, erroring now");
    }
    return {
        contact: {
            primaryContatctId: primary_element.id,
            emails: raw_data.map(x => x.email).filter(x => x !== null).filter(onlyUnique),
            phoneNumbers: raw_data.map(x => x.phoneNumber).filter(x => x !== null).filter(onlyUnique),
            secondaryContactIds: raw_data.map(x => x.id).filter(x => x !== primary_element.id)
        }
    };
}
function array_from_nullable_element(x) {
    if (x === null || x === undefined)
        return [];
    return [x];
}
function insert_primary_into_db_and_get_result(req_body) {
    return __awaiter(this, void 0, void 0, function* () {
        const { insertId } = yield async_push_query("insert into contact set ?", req_body, db_connection);
        const result = {
            contact: {
                primaryContatctId: insertId,
                emails: array_from_nullable_element(req_body.email),
                phoneNumbers: array_from_nullable_element(req_body.phoneNumber),
                secondaryContactIds: []
            }
        };
        return result;
    });
}
function sort_the_contact_entities(left, right) {
    if (left.createdAt < right.createdAt)
        return -1;
    if (left.createdAt > right.createdAt)
        return 1;
    return 0;
}
function insert_secondary_into_db_and_get_result(req_body) {
    return __awaiter(this, void 0, void 0, function* () {
        const contact_data = yield get_all_assosiated_contacts_for_this_entity(req_body);
        if (req_body.email === undefined || req_body.phoneNumber === undefined) {
            return transform_raw_db_data_to_result(contact_data);
        }
        const latest_contact = contact_data.sort(sort_the_contact_entities)[contact_data.length - 1];
        const { insertId } = yield async_push_query("insert into contact set ?", Object.assign(Object.assign({}, req_body), { linkedId: latest_contact.id, linkPrecedence: "secondary" }), db_connection);
        const result = transform_raw_db_data_to_result(contact_data);
        result.contact.emails = [...result.contact.emails, ...array_from_nullable_element(req_body.email)].filter(onlyUnique);
        result.contact.phoneNumbers = [...result.contact.phoneNumbers, ...array_from_nullable_element(req_body.phoneNumber)].filter(onlyUnique);
        result.contact.secondaryContactIds = [...result.contact.secondaryContactIds, insertId];
        return result;
    });
}
function merge_the_two_lists_and_return_result(left_list, right_list) {
    return __awaiter(this, void 0, void 0, function* () {
        const new_list = [...left_list, ...right_list];
        new_list.sort(sort_the_contact_entities);
        const entry_needing_precedence_update = new_list.map((e, i) => [e, i]).find(([e, i]) => e.linkPrecedence === "primary" && i > 0)[0].id;
        yield async_push_query(`UPDATE contact SET linkPrecedence  = ?,updatedAt = CURRENT_TIMESTAMP  WHERE id = ?;`, ['secondary', entry_needing_precedence_update], db_connection);
        for (let i = 1; i < new_list.length; i++) {
            if (new_list[i].linkedId === new_list[i - 1].id)
                continue;
            yield async_push_query(`UPDATE contact SET linkedId = ? WHERE id = ?`, [new_list[i - 1].id, new_list[i].id], db_connection);
            new_list[i].linkedId = new_list[i - 1].id;
        }
        return transform_raw_db_data_to_result(new_list);
    });
}
function number_of_rows() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield async_get_query("select count(*) from contact", db_connection);
        return res[0]['count(*)'];
    });
}
