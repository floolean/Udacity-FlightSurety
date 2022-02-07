
var Test = require('../config/testConfig.js');
const BN = require('bn.js');
const { web } = require('webpack');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  before('setup contract', async () => {

    config = await Test.Config(accounts);

    await config.flightSuretyData.setOperatingStatus(true);
    await config.flightSuretyData.setContractOwnerApp(config.flightSuretyApp.address);

		config.MAX_INSURANCE = await config.flightSuretyApp.MAX_INSURANCE.call();
		config.AIRLINE_REGISTRATION_FEE = await config.flightSuretyApp.AIRLINE_REGISTRATION_FEE.call();

		for (let i = 0; i < 2; ++i){
			let index = 1 + i;
			let account = accounts[index];
			await config.flightSuretyApp.registerAirline(account, "Airline #" + index);
			await config.flightSuretyApp.fund({from:account, value:config.AIRLINE_REGISTRATION_FEE});
		}
		await config.flightSuretyApp.registerAirline(accounts[3], "Airline #3");

		config.oracles = [];

		for (let i = 0; i < 20; ++i){
			let index = 20 + i;
			let account = accounts[index];
			await config.flightSuretyApp.registerOracle({from:account,value:web3.utils.toWei("1","ether")});
			let indexes = await config.flightSuretyApp.getMyIndexes.call({from:account});
			config.oracles.push({
				account: account,
				indexes: indexes
			});
		}

		for (let i = 0; i < config.flights.length; ++i){
			const flight = config.flights[i];
			flight.key = await config.flightSuretyApp.getFlightKey.call(flight.airline,flight.number,flight.timestamp);
		}

  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyApp.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyApp.setOperatingStatus(false,  { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(true);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyApp.setOperatingStatus(false);

      let reverted = false;
      try 
      {
          await config.flightSuretyApp.registerAirline(config.testAddresses[2], "AIRLINE");
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyApp.setOperatingStatus(true);

  });

  it('(airline) there are three registered airlines', async () => {
    
		const airlineCount = await config.flightSuretyData.getAirlineCount();
		assert.equal(airlineCount, 3, "There should be three airlines");

		for (let i = 1; i < 4; ++i) {
			let account = accounts[i];
			const airlineExists = await config.flightSuretyData.isAirline.call(account);
			assert.equal(airlineExists, true, "Airline #',i,'does not exist");
		}
	
  });

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
		let newAirline = accounts[4];

    try {
			const result = await config.flightSuretyApp.registerAirline(newAirline, "Airline #4", {from: accounts[3]});
    }
    catch(e) 
		{
    }

		const isAirline = await config.flightSuretyData.isAirline.call(newAirline);

    assert.equal(isAirline, false, "Airline should not be able to register another airline if it hasn't provided funding");

  });

	it('(airline) can register an Airline using registerAirline() if it is funded', async () => {
    
    let newAirline = accounts[4];
    try {
				await config.flightSuretyApp.fund({from: accounts[3], value: config.AIRLINE_REGISTRATION_FEE});
        await config.flightSuretyApp.registerAirline(newAirline, "Test Airline", {from: config.firstAirline});
				await config.flightSuretyApp.fund({from: newAirline, value: config.AIRLINE_REGISTRATION_FEE});
    }
    catch(e) 
		{
			console.error(e);
    }

		const isAirline = await config.flightSuretyData.isAirline.call(newAirline);
    assert.equal(isAirline, true, "Airline should be able to register another airline if it has provided funding");
		const isFundedAirline = await config.flightSuretyApp.isFundedAirline.call(newAirline);
    assert.equal(isFundedAirline, true, "Airline should be funded");
  });

	it('(airline) at least 50% of airlines must vote to register a new airline', async () => {
    
    let newAirline = accounts[5];

    await config.flightSuretyApp.registerAirline(newAirline, "Test Airline", {from: accounts[1]});
		let isAirline = await config.flightSuretyData.isAirline.call(newAirline);
    assert.equal(isAirline, false, "Airline should not yet be registered");
    await config.flightSuretyApp.registerAirline(newAirline, "Test Airline", {from: accounts[2]});
		isAirline = await config.flightSuretyData.isAirline.call(newAirline);
    assert.equal(isAirline, true, "Airline should now be registered");

  });

	it('(airline) Airline should not be able to register a flight if it is not funded', async () => {
    
		const flight = config.flights[0];
		let reverted = false;
		try {
			await config.flightSuretyApp.registerFlight(flight.number, flight.timestamp, {from: flight.airline});
		}
		catch(e){
			reverted = true;
		}
		assert.equal(reverted, true, "Airline was able to register flight even though it was unfunded");  

  });

	it('(airline) Airline should be able to register a flight if it is funded', async () => {
    
		const flight = config.flights[0];

		await config.flightSuretyApp.fund({from: flight.airline, value: config.AIRLINE_REGISTRATION_FEE});

		let reverted = false;
		try {
			await config.flightSuretyApp.registerFlight(flight.number, flight.timestamp, {from: flight.airline});
		}
		catch(e){
			reverted = true;
		}
		assert.equal(reverted, false, "Airline was not able to register flight even though it was funded");  

  });

	it('(insurance) Customer should not be able to buy insurance on a non existing flight', async () => {
    
		const flight = config.flights[0];

		let reverted = false;
		try {
			await config.flightSuretyApp.buyInsurance(flight.airline, "Test Flight", 0, {value:web3.utils.toWei("200","wei"), from: accounts[10]});
		}
		catch(e){
			reverted = true;
		}
		assert.equal(reverted, true, "Customer was able to buy insurance on a non existing flight.");  

  });

	it('(insurance) Customer should be able to buy insurance on an existing flight', async () => {
    
		const flight = config.flights[0];

		let reverted = false;
		try {
			await config.flightSuretyApp.buyInsurance(flight.airline, flight.number, flight.timestamp, {value:config.MAX_INSURANCE, from: accounts[10]});
		}
		catch(e){
			reverted = true;
		}
		const insuranceKey = await config.flightSuretyApp.getInsuranceKey(flight.key, {from: accounts[10]});

		const insurance = await config.flightSuretyData.getInsurance(insuranceKey);
	
		assert.equal(new BN(insurance.insuredAmount).toString(), config.MAX_INSURANCE.toString(), "Insured amount does not match.");
		assert.equal(reverted, false, "Customer was not able to buy insurance on an existing flight.");  

  });

	it('(insurance) Customer cannot request insurance withdrawal of a flight with status code STATUS_CODE_UNKNOWN ', async () => {
    
		const flight = config.flights[0];

		let reverted = false;
		try {
			await config.flightSuretyApp.requestInsuranceWithdrawal(flight.airline, flight.number, flight.timestamp, {from: accounts[10]});
		}
		catch(e){
			reverted = true;
		}
		assert.equal(reverted, true, "Customer was able to request insurance withdrawal on a flight with status code STATUS_CODE_UNKNOWN.");  

  });

	it('(insurance) Customer cannot request insurance withdrawal of a flight with status code STATUS_CODE_ON_TIME ', async () => {

		const flight = config.flights[0];

		await config.flightSuretyApp.fetchFlightStatus(flight.airline, flight.number, flight.timestamp, {from: accounts[10]});

		await submitOracleResponses(flight, 10);
		
		let reverted = false;
		try {
			await config.flightSuretyApp.requestInsuranceWithdrawal(flight.airline, flight.number, flight.timestamp, {from: accounts[10]});
		}
		catch(e){
			reverted = true;
		}
		assert.equal(reverted, true, "Customer was able to request insurance withdrawal on a flight with status code STATUS_CODE_ON_TIME.");  

  });

	it('(insurance) Customer should not be able to buy insurance on a flight with status > STATUS_CODE_UNKNOWN', async () => {
    
		const flight = config.flights[0];

		let reverted = false;
		try {
			await config.flightSuretyApp.buyInsurance(flight.airline, flight.number, flight.timestamp, {value:config.MAX_INSURANCE, from: accounts[10]});
		}
		catch(e){
			reverted = true;
		}
		assert.equal(reverted, true, "Customer was not able to buy insurance on a flight with status code > STATUS_CODE_UNKNOWN");  

  });

	it('(insurance) Customer cannot withdraw insurance before submitting withdrawal request', async () => {

		const flight = config.flights[1];

		await config.flightSuretyApp.registerFlight(flight.number,flight.timestamp,{from:flight.airline});
		
		await config.flightSuretyApp.buyInsurance(flight.airline, flight.number, flight.timestamp, {value:config.MAX_INSURANCE, from: accounts[10]});

		await config.flightSuretyApp.fetchFlightStatus(flight.airline, flight.number, flight.timestamp, {from: accounts[10]});

		await submitOracleResponses(flight, 20);

		let reverted = false;
		try {
			await config.flightSuretyApp.withdrawInsurance(flight.airline, flight.number, flight.timestamp, {from: accounts[10]});
		}
		catch(e){
			reverted = true;
		}

		const insuranceKey = await config.flightSuretyApp.getInsuranceKey(flight.key, {from: accounts[10]});

		let insurance = await config.flightSuretyData.getInsurance(insuranceKey);

		assert.equal(insurance.insuredAmount.toString(), config.MAX_INSURANCE.toString(), "Insured amount has changed" );

		assert.equal(reverted, true, "Customer was able to withdraw insurance prior submitting withdrawal request.");   

  });

	it('(insurance) Customer can withdraw insurance of a flight with status code > STATUS_CODE_ON_TIME ', async () => {

		const flight = config.flights[1];

		const insuranceKey = await config.flightSuretyApp.getInsuranceKey(flight.key, {from: accounts[10]});

		let insurance = await config.flightSuretyData.getInsurance(insuranceKey);

		await config.flightSuretyApp.requestInsuranceWithdrawal(flight.airline, flight.number, flight.timestamp, {from: accounts[10]});

		insurance = await config.flightSuretyData.getInsurance(insuranceKey);

		let reverted = false;
		try {
			await config.flightSuretyApp.withdrawInsurance(flight.airline, flight.number, flight.timestamp, {from: accounts[10]});
		}
		catch(e){
			reverted = true;
		}
		insurance = await config.flightSuretyData.getInsurance(insuranceKey);
		assert.equal(reverted, false, "Customer was not able to withdraw insurance prior submitting withdrawal request.");   

		insurance = await config.flightSuretyData.getInsurance(insuranceKey);

		assert.equal(insurance.credit.toString(), new BN("0").toString(), "Credit is not zero." );
		assert.equal(insurance.insuredAmount.toString(), new BN("0").toString(), "InsuredAmount is not zero." );

  });

	async function submitOracleResponses(flight,statusCode){

		let submittedCount = 0;

		for (let i = 0; i < 20; ++i){
			let oracle = config.oracles[i];
			for (let j = 0; j < oracle.indexes.length; ++j){
				try {
					await config.flightSuretyApp.submitOracleResponse(oracle.indexes[j],flight.airline, flight.number, flight.timestamp, statusCode, {from: oracle.account});
					submittedCount++;
					if (submittedCount >= 3) break;
				}
				catch(e){
					//console.log(i,j,oracle.indexes[j].toNumber(),e);
				}
			}
			if (submittedCount >= 3) break;
		}
		let flightInstance = await config.flightSuretyData.getFlight.call(flight.key);
		assert.equal(parseInt(flightInstance[2]),statusCode, "Flight status code could not be set");
		return submittedCount >= 3;
	
	}
 

});
