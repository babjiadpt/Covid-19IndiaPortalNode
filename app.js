const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server started at http://localhost3000");
    });
  } catch (e) {
    console.log(`DB ERROR: ${e.message}`);
  }
};

initializeDbAndServer();

const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDbDistrictObjectToResponseDistrictObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const authenticateTokenMiddleware = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "verifyToken", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API: 1;
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userDetailsQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
  const userDetails = await db.get(userDetailsQuery);

  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "verifyToken");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API: 2;
//Returns a list of all states in the state table
app.get("/states/", authenticateTokenMiddleware, async (request, response) => {
  const getAllStatesQuery = `
    SELECT
      *
    FROM 
        state`;
  const statesArray = await db.all(getAllStatesQuery);
  response.send(
    statesArray.map((eachState) => convertDbObjectToResponseObject(eachState))
  );
});

//API: 3;
//Returns a state based on the state ID
app.get(
  "/states/:stateId/",
  authenticateTokenMiddleware,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateQuery = `
    SELECT
      *
    FROM 
        state
    WHERE
        state_id = '${stateId}';`;
    const stateObject = await db.get(getStateQuery);
    response.send(convertDbObjectToResponseObject(stateObject));
  }
);

//API: 4;
//Create a district in the district table, district_id is auto-incremented
app.post(
  "/districts/",
  authenticateTokenMiddleware,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const addDistrictQuery = `
    INSERT INTO
      district (district_name, state_id, cases, cured, active, deaths)
    VALUES('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}')`;
    await db.run(addDistrictQuery);
    response.send("District Successfully Added");
  }
);

//API: 5;
//Returns a district based on the district ID
app.get(
  "/districts/:districtId/",
  authenticateTokenMiddleware,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT
      *
    FROM 
        district
    WHERE
        district_id = '${districtId}';`;
    const districtObject = await db.get(getDistrictQuery);
    response.send(
      convertDbDistrictObjectToResponseDistrictObject(districtObject)
    );
  }
);

//API: 6;
//Deletes a district from the district table based on the district ID
app.delete(
  "/districts/:districtId/",
  authenticateTokenMiddleware,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM
        district
    WHERE
        district_id = '${districtId}';`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API: 7;
//Updates the details of a specific district based on the district ID
app.put(
  "/districts/:districtId/",
  authenticateTokenMiddleware,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;

    const updateDistrictQuery = `
    UPDATE
      district 
    SET 
        district_name = '${districtName}',
        state_id = '${stateId}',
        cases = '${cases}', 
        cured = '${cured}',
        active = '${active}',
        deaths = '${deaths}'
        
    WHERE 
        district_id = '${districtId}';`;

    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API:8;
//Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID
app.get(
  "/states/:stateId/stats/",
  authenticateTokenMiddleware,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
          SUM(cases) AS totalCases,
          SUM(cured) AS totalCured,
          SUM(active) AS totalActive,
          SUM(deaths) AS totalDeaths
    FROM 
          district
    WHERE
          state_id = '${stateId}';`;

    const stateStatsObject = await db.get(getStateStatsQuery);
    response.send(stateStatsObject);
  }
);

module.exports = app;
