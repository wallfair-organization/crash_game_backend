const path = require("path");
const fs = require("fs");

let yml = fs.readFileSync(path.resolve(__dirname, `spec-${process.env.stage}.yml`)).toString();
console.log(
    yml
    .replace("$VERSION", process.env.version)
    .replace("$JWT", process.env.JWT_KEY)
    .replace("$POSTGRES_PASSWORD", process.env.POSTGRES_PASSWORD)
    .replace("$MONGO_DB_URL", process.env.MONGO_DB_URL)
    );