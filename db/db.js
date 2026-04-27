const mongoose = require("mongoose")
async function connectDB(conn_key) {
    try{
        await mongoose.connect(conn_key)
        console.log("db connected")
    }catch(err){
        console.error(err.message)
    }
}
module.exports = connectDB