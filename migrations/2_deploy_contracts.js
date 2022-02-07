const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const Model = artifacts.require("Model");
const SafeMath = artifacts.require("SafeMath");
const Utils = artifacts.require("Utils");
const fs = require('fs');
const moment = require('moment');
const BN = require('bn.js');



module.exports = async function(deployer,network,accounts) {

	await deployer.deploy(Utils);
	await deployer.link(Utils, [FlightSuretyApp]);
	await deployer.deploy(SafeMath);
	await deployer.link(SafeMath, [FlightSuretyApp]);
	await deployer.deploy(Model);
	await deployer.link(Model, [FlightSuretyApp,FlightSuretyData]);

	await deployer.deploy(FlightSuretyData);
	const dataInstance = await FlightSuretyData.deployed();

	await deployer.deploy(FlightSuretyApp,FlightSuretyData.address);
	const appInstance = await FlightSuretyApp.deployed();

	if (network == "test") return;

	const MIN_INSURANCE = await appInstance.MIN_INSURANCE.call();
	const MAX_INSURANCE = await appInstance.MAX_INSURANCE.call();
	const ORACLE_REGISTRATION_FEE = await appInstance.ORACLE_REGISTRATION_FEE.call();
	const AIRLINE_REGISTRATION_FEE = await appInstance.AIRLINE_REGISTRATION_FEE.call();
	const STATUS_CODE_UNKNOWN = await appInstance.STATUS_CODE_UNKNOWN.call();
	const STATUS_CODE_ON_TIME = await appInstance.STATUS_CODE_ON_TIME.call();
	const STATUS_CODE_LATE_AIRLINE = await appInstance.STATUS_CODE_LATE_AIRLINE.call();
	const STATUS_CODE_LATE_WEATHER = await appInstance.STATUS_CODE_LATE_WEATHER.call();
	const STATUS_CODE_LATE_TECHNICAL = await appInstance.STATUS_CODE_LATE_TECHNICAL.call();
	const STATUS_CODE_LATE_OTHER = await appInstance.STATUS_CODE_LATE_OTHER.call();

	await dataInstance.setContractOwnerApp(appInstance.address);
	await dataInstance.setOperatingStatus(true);

	let airlines = [
	{
		name: "Lufthansa",
		abbr: "LH",
		registered: false
	},
	{
		name: "Ryanair",
		abbr: "RY",
		registered: false
	},
	{
		name: "Virgin",
		abbr: "VN",
		registered: false
	}];

	for (var i = 0; i < airlines.length; ++i) {
		let index = i+1;
		let airline = airlines[i];
		let account = accounts[index];
		airline.address = account;
		let result = await appInstance.registerAirline(account, airline.name);
		airline.registered = true;
		result = await appInstance.fund({from: account, value: AIRLINE_REGISTRATION_FEE});
		console.log("Registered airline", airline.name, airline.address);
	}

	let flights = [];
	let currentAirline = 0;
	for (var i = 0; i < 9; ++i) {	
		let airline = airlines[ currentAirline ];
		currentAirline = (currentAirline+1) >= airlines.length ? 0 : ++currentAirline;
		let flightNumber = airline.abbr + (Math.floor(Math.random() * 99));
		let now = moment();
		let timestamp = now.add("1","minutes").add(Math.floor(Math.random() * 600)	, "seconds").startOf("minute");
		let key = await appInstance.getFlightKey.call(airline.address,flightNumber,timestamp.unix());
		let flight = {
			number: flightNumber,
			timestamp: timestamp.toDate(),
			unixTimestamp: timestamp.unix(),
			airline: airline.address,
			airlineName: airline.name,
			key: key
		};
		flights.push(flight);
		await appInstance.registerFlight(flightNumber, timestamp.unix(),{from: airline.address});
		console.log('Registered',airline.name,'flight',flightNumber,'at',timestamp.format("HH:mm"));
	}

	let oracles = [];

	for (let i = 20; i < 40; ++i){
		await appInstance.registerOracle({from:accounts[i], value: ORACLE_REGISTRATION_FEE});
		const indexes = await appInstance.getMyIndexes({from:accounts[i]});
		oracles.push({address:accounts[i], indexes: indexes});
		console.log("Registered oracle",accounts[i],"[",indexes[0].toNumber(),indexes[1].toNumber(),indexes[2].toNumber(),"]");
	}

	let config = {
		localhost: {
			providerHttpUrl: 'http://localhost:7545',
			providerWebsocketUrl: 'ws://localhost:7545',
			serverUrl: 'http://localhost:3000',
			dataAddress: FlightSuretyData.address,
			appAddress: FlightSuretyApp.address,
			airlines: airlines,
			flights: flights,
			oracles: oracles,
			MIN_INSURANCE: MIN_INSURANCE,
			MAX_INSURANCE: MAX_INSURANCE,
			ORACLE_REGISTRATION_FEE: ORACLE_REGISTRATION_FEE,
			AIRLINE_REGISTRATION_FEE: AIRLINE_REGISTRATION_FEE,
			statusCodes: {
				STATUS_CODE_UNKNOWN: STATUS_CODE_UNKNOWN.toNumber(),
				STATUS_CODE_ON_TIME: STATUS_CODE_ON_TIME.toNumber(),
				STATUS_CODE_LATE_AIRLINE: STATUS_CODE_LATE_AIRLINE.toNumber(),
				STATUS_CODE_LATE_WEATHER: STATUS_CODE_LATE_WEATHER.toNumber(),
				STATUS_CODE_LATE_TECHNICAL: STATUS_CODE_LATE_TECHNICAL.toNumber(),
				STATUS_CODE_LATE_OTHER: STATUS_CODE_LATE_OTHER.toNumber(),
			},
			statusCodesArray: [
				STATUS_CODE_UNKNOWN.toNumber(),
				STATUS_CODE_ON_TIME.toNumber(),
				STATUS_CODE_LATE_AIRLINE.toNumber(),
				STATUS_CODE_LATE_WEATHER.toNumber(),
				STATUS_CODE_LATE_TECHNICAL.toNumber(),
				STATUS_CODE_LATE_OTHER.toNumber(),
			]
		}
	};

	fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
	fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '\t'), 'utf-8');

}