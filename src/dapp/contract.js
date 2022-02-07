import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import FlightSuretyData from "../../build/contracts/FlightSuretyData.json";
import Config from "./config.json";
import Web3 from "web3/dist/web3.min";

const gasLimit = 8000000;

export default class Contract {
	constructor(network, callback) {
		this.config = Config[network];
		this.web3 = new Web3(new Web3.providers.WebsocketProvider(this.config.providerWebsocketUrl));
		this.flightSuretyApp = new this.web3.eth.Contract(
			FlightSuretyApp.abi,
			this.config.appAddress
		);
		this.flightSuretyData = new this.web3.eth.Contract(
			FlightSuretyData.abi,
			this.config.dataAddress
		);
		this.initialize(callback);
		this.owner = null;
		this.passenger = null;
	}

	initialize(callback) {
		this.web3.eth.getAccounts((error, accts) => {
			this.owner = accts[0];
			this.passenger = accts[10];
			callback();
		});
	}

	isOperational(callback) {
		let self = this;
		self.flightSuretyApp.methods
			.isOperational()
			.call({ from: self.owner }, callback);
	}

	listenFor(event, callback) {
		let ev = this.flightSuretyApp.events[event];
		if (ev) {
			ev().on("data", callback);
		}
	}

	getBalance(account) {
		return this.web3.eth.getBalance(account);
	}

	async getFlight(flightKey) {
		let flight = await this.flightSuretyData.methods
			.getFlight(flightKey)
			.call({ from: this.passenger });
		return flight;
	}

	async getInsurance(flightKey) {
		let insuranceKey = await this.flightSuretyApp.methods
			.getInsuranceKey(flightKey)
			.call({ from: this.passenger });
		let insurance = await this.flightSuretyData.methods
			.getInsurance(insuranceKey)
			.call({ from: this.passenger });
		return insurance;
	}

	async buyInsurance(flight, value) {
		let receipt = await this.flightSuretyApp.methods
			.buyInsurance(flight.airline, flight.number, flight.unixTimestamp)
			.send({ from: this.passenger, value: value, gasLimit: gasLimit });
		return receipt;
	}

	async requestInsuranceWithdrawal(flight) {
		let receipt = await this.flightSuretyApp.methods
			.requestInsuranceWithdrawal(flight.airline, flight.number, flight.unixTimestamp)
			.send({ from: this.passenger, gasLimit: gasLimit });
		return receipt;
	}

	async withdrawInsurance(flight) {
		let receipt = await this.flightSuretyApp.methods
			.withdrawInsurance(flight.airline, flight.number, flight.unixTimestamp)
			.send({ from: this.passenger, gasLimit: gasLimit });
		return receipt;
	}

	async fetchFlightStatus(flight) {
		let self = this;
		return await self.flightSuretyApp.methods
			.fetchFlightStatus(flight.airline, flight.number, flight.unixTimestamp)
			.send({ from: self.owner, gasLimit: gasLimit });
	}
}
