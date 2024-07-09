import path from 'path';
import fs from 'fs'
const dotenv = require('dotenv')
const envFilePath = path.resolve(process.cwd(), '.env');
const envFilePathInDist = path.resolve(process.cwd(),'dist', '.env');
// Check if the .env file exists
function configure_dotnev(){
    if (fs.existsSync(envFilePath)) {
        console.log(`${envFilePath} exists, using that to config`)
        dotenv.config({path:envFilePath})
    }else if(fs.existsSync(envFilePathInDist)){
        console.log(`${envFilePathInDist} exists, using that to config`)
        dotenv.config({path:envFilePathInDist})
    }else{
        throw Error("unable to find .env file")
    }
}


export {configure_dotnev}