const FlightSuretyApp = require("../../build/contracts/FlightSuretyApp.json");
const FlightSuretyData = require("../../build/contracts/FlightSuretyData.json");
const Config = require("./config.json");
const Web3 = require("web3");
const express = require("express");

let config = Config["localhost"];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.providerWebsocketUrl));

web3.eth.getAccounts().then(async (e) => {
	web3.eth.defaultAccount = e[0];
	let balance = await web3.eth.getBalance(e[0]);
	console.log("Default account balance:", web3.utils.fromWei(balance));

	for (let i = 0; i < config.airlines.length; ++i) {
		let airline = config.airlines[i];
		balance = await web3.eth.getBalance(airline.address);
		console.log(
			"Airline",
			airline.name,
			"balance:",
			web3.utils.fromWei(balance)
		);
	}

	for (let i = 0; i < config.oracles.length; ++i) {
		let oracle = config.oracles[i];
		balance = await web3.eth.getBalance(oracle.address);
		console.log(
			"Oracle",
			oracle.address,
			"balance:",
			web3.utils.fromWei(balance)
		);
	}

	flightSuretyApp.events
		.OracleRequest()
		.on("data", async (event) => {
			let { index, airline, number, timestamp } = event.returnValues;
			console.log("Oracle request received", index, airline, number, timestamp);
			let flightStatusCode =
				config.statusCodesArray[
					randomIntFromInterval(1, config.statusCodesArray.length - 1)
				];
			if (Math.random()>0.7){
				flightStatusCode = config.statusCodesArray[2];
			}
			
			for (let i = 0; i < config.oracles.length; ++i) {
				let oracle = config.oracles[i];
				if (!oracle.indexes.includes(index)) continue;
				try {
					let receipt = await flightSuretyApp.methods
						.submitOracleResponse(
							index,
							airline,
							number,
							timestamp,
							flightStatusCode
						)
						.send({ from: oracle.address,gasLimit:8000000 });
					console.log(
						"Oracle response submitted",
						flightStatusCode,
						index,
						airline,
						number,
						timestamp
					);
				} catch (err) {
					console.error(err.message);
				}
			}
		});
});

let flightSuretyApp = new web3.eth.Contract(
	FlightSuretyApp.abi,
	config.appAddress
);

let flightSuretyData = new web3.eth.Contract(
	FlightSuretyData.abi,
	config.dataAddress
);

const app = express();

app.use(function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header(
		"Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept"
	);
	next();
});

app.get("/airlines", (req, res) => {
	res.json(config.airlines);
});

app.get("/flights", (req, res) => {
	res.json(config.flights);
});

app.get("/oracles", (req, res) => {
	res.json(config.oracles);
});

app.get("/airline-registration-fee", (req, res) => {
	res.json(config.AIRLINE_REGISTRATION_FEE);
});

app.get("/insurance", (req, res) => {
	res.json(config.AIRLINE_REGISTRATION_FEE);
});

app.get("/flight/:flightkey/status", async (req, res) => {
	try {
		let flightkey = req.params.flightkey;
		let flight = await flightSuretyData.methods.getFlight(flightkey).call();
		return res.json({ statusCode: flight.statusCode });
	} catch (e) {
		console.error(e);
	}

	return res.json({ statusCode: "0" });
});

function randomIntFromInterval(min, max) {
	// min and max included
	return Math.floor(Math.random() * (max - min + 1) + min);
}

module.exports = app;
