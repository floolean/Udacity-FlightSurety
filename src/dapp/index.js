window.require = function (module) {
	return window[module];
};

import DOM from "./dom";
import Contract from "./contract";
import Config from "./config.json";
import "./flightsurety.css";
import moment from "moment/dist/moment.js";
import Web3 from "web3/dist/web3.min";
import { web } from "webpack";

(async () => {
	let addressDisplay = null;
	let balanceDisplay = null;
	let insurancePanel = null;
	let insuranceValue = null;
	let insuranceSlider = null;
	let minInsurance = null;
	let maxInsurance = null;
	let buyInsuranceButton = null;
	let requestWithdrawalButton = null;
	let withdrawInsuranceButton = null;
	let insuranceDisplay = null;
	let requestOracleUpdate = null;
	let selectedFlight = null;
	let config = Config["localhost"];
	let serverUrl = config.serverUrl;
	let contract = new Contract("localhost", () => {
		contract.isOperational((error, result) => {
			DOM.elid("operationalStatus").textContent = result;
		});
		contract.listenFor("OracleRequest", (data) => {
			// loadFlight(selectedFlight);
		});
		contract.listenFor("OracleReport", (data) => {
			// loadFlight(selectedFlight);
		});
		contract.listenFor("FlightStatusInfo", (data) => {
			loadFlight(selectedFlight);
		});
		contract.listenFor("InsuranceBought", (data) => {
			loadFlight(selectedFlight);
		});
		contract.listenFor("InsuranceWithdrawalRequested", (data) => {
			loadFlight(selectedFlight);
		});
		contract.listenFor("InsuranceCreditWithdrawn", (data) => {
			loadFlight(selectedFlight);
		});

		requestOracleUpdate = DOM.elid("requestOracleUpdate");
		requestOracleUpdate.addEventListener("click", async () => {
			try {
				let result = await contract.fetchFlightStatus(selectedFlight);
				requestOracleUpdate.hide();
			} catch (err) {
				console.error(err);
			}
		});
		insuranceValue = DOM.elid("insuranceValue");
		insuranceSlider = DOM.elid("insuranceSlider");
		insuranceSlider.addEventListener("input", (e) => {
			let value = insuranceSlider.value + "00";
			insuranceValue.textContent =
				Web3.utils.fromWei(value, "ether").substr(0, 9) + " ETH";
		});
		minInsurance = DOM.elid("minInsurance");
		minInsurance.addEventListener("click", () => {
			insuranceSlider.value = "1";
			insuranceSlider.dispatchEvent(new Event("input"));
		});
		maxInsurance = DOM.elid("maxInsurance");
		maxInsurance.addEventListener("click", () => {
			insuranceSlider.value = "10000000000000000";
			insuranceSlider.dispatchEvent(new Event("input"));
		});
		buyInsuranceButton = DOM.elid("buyInsuranceButton");
		buyInsuranceButton.addEventListener("click", buyInsuranceClicked);
		requestWithdrawalButton = DOM.elid("requestWithdrawalButton");
		requestWithdrawalButton.addEventListener("click", requestWithdrawalClicked);
		withdrawInsuranceButton = DOM.elid("withdrawInsuranceButton");
		withdrawInsuranceButton.addEventListener("click", withdrawInsuranceClicked);

		insuranceDisplay = DOM.elid("insuranceDisplay");
		insurancePanel = DOM.elid("insurancePanel");
		insurancePanel.parentNode.removeChild(insurancePanel);

		addressDisplay = DOM.elid("addressDisplay");
		balanceDisplay = DOM.elid("balanceDisplay");

		let flightsTable = DOM.elid("flights");
		for (let i = 0; i < config.flights.length; ++i) {
			let flight = config.flights[i];
			let time = moment(flight.timestamp).format("HH:mm");
			let a = DOM.a({ href: "#" }, flight.number);
			a.addEventListener("click", (e) => {
				e.preventDefault();
				loadFlight(flight);
			});
			flightsTable.appendChild(
				DOM.tr(
					{ id: flight.key },
					DOM.td(flight.airlineName),
					DOM.td(a),
					DOM.td(time),
					DOM.td({ className: "status-" + flight.key }, "...")
				)
			);
		}

		setInterval(update, 5000);

		update();
	});

	async function buyInsuranceClicked() {
		try {
			let value = insuranceSlider.value + "00";
			await contract.buyInsurance(selectedFlight, value);
		} catch (err) {

			displayTxError(err);
		}
	}

	async function requestWithdrawalClicked() {
		try {
			await contract.requestInsuranceWithdrawal(selectedFlight);
		} catch (err) {
			console.error(err.message);
		}
	}

	async function withdrawInsuranceClicked() {
		try {
			await contract.withdrawInsurance(selectedFlight);
		} catch (err) {
			console.error(err.message);
		}
	}

	async function loadFlight(flight) {
		selectedFlight = flight;
		if (!selectedFlight) {
			return;
		}
		requestOracleUpdate.hide();
		insuranceDisplay.hide();
		buyInsuranceButton.hide();
		requestWithdrawalButton.hide();
		withdrawInsuranceButton.hide();

		let insurance = await contract.getInsurance(flight.key);
		let flightStatus = parseInt(
			(await contract.getFlight(flight.key)).statusCode
		);

		if (flightStatus == 0) requestOracleUpdate.show();

		let flightDetails = DOM.elid("flightDetails");
		DOM.clear(flightDetails);
		flightDetails.appendChild(insurancePanel);
		DOM.elid("airline").textContent = flight.airlineName;
		DOM.elid("number").textContent = flight.number;
		DOM.elid("timestamp").textContent = moment(flight.timestamp).format(
			"HH:mm"
		);
		DOM.elid("status").textContent = getStatusCodeName(flightStatus);

		if (insurance.registered == true) {
			maxInsurance.setAttribute("disabled", "");
			minInsurance.setAttribute("disabled", "");
			insuranceSlider.setAttribute("disabled", "");
			insuranceDisplay.show();
			insuranceDisplay.innerHTML =
				"Insured Value: " +
				Web3.utils.fromWei(insurance.insuredAmount) + " ETH" +
				"</br>Credit: " +
				Web3.utils.fromWei(insurance.credit) + " ETH";
			if (flightStatus == 20){
				if (insurance.insuredAmount > 0) {
					requestWithdrawalButton.show();
				} else if (insurance.credit > 0) {
					withdrawInsuranceButton.show();
				} else {
					insuranceDisplay.textContent = "Insurance Withdrawn";
				}
			}
			else if (flightStatus == 0) {
				insuranceDisplay.innerHTML = "Awaiting status update..</br>"+insuranceDisplay.innerHTML;
			}
			else {
				insuranceDisplay.innerHTML = "Sorry, it's not the airline's fault.</br>"+insuranceDisplay.innerHTML;
			}
		} else {
			maxInsurance.removeAttribute("disabled");
			minInsurance.removeAttribute("disabled");
			insuranceSlider.removeAttribute("disabled");
			insuranceDisplay.hide();
			insuranceSlider.value = "5000000000000000";
			insuranceValue.textContent =
				Web3.utils
					.fromWei(insuranceSlider.value + "00", "ether")
					.substr(0, 12) + " ETH";
			let flightData = await contract.getFlight(flight.key);
			switch (flightData.statusCode) {
				case "0":
					buyInsuranceButton.show();
					break;
				case "10":
					break;
				case "20":
					break;
				default:
					break;
			}
		}
	}

	async function update() {
		let balance = await contract.getBalance(contract.passenger);
		balanceDisplay.textContent = Web3.utils.fromWei(balance);
		addressDisplay.textContent =
			"0x.." + contract.passenger.substr(contract.passenger.length - 3);
		let delay = 0;
		for (let i = 0; i < config.flights.length; ++i) {
			let flight = config.flights[i];
			setTimeout(() => updateFlight(flight), delay);
			delay += 100;
		}
	}

	function updateFlight(flight) {
		jQuery.get(serverUrl + "/flight/" + flight.key + "/status", (data) => {
			let statusCode = parseInt(data.statusCode);
			let statusCodeName = getStatusCodeName(statusCode);
			DOM.elcl("status-" + flight.key).textContent = statusCodeName;
		});
	}

	async function sendAndConfirmTransaction(asyncTxFunc) {
		try {
			const previousBlock = await web3.eth.getBlockNumber();
			const receipt = await asyncTxFunc();
			const txHash = receipt.transactionHash;
			const trx = await web3.eth.getTransaction(txHash);
			return trx.blockNumber === null ? 0 : previousBlock - trx.blockNumber;
		} catch (error) {
			console.log(error);
			return error;
		}
	}

	function displayTxError(error){
		let data = error.data;
		let keys = Object.keys(data);
		for(let i = 0; i < keys.length; ++i){
			let key = keys[i];
			if (key.startsWith('0x')){
				getRevertReason(key);
			}
		}
	}

	async function getRevertReason(txHash) {
		try {
			const tx = await contract.web3.eth.getTransaction(txHash);
	
			var result = await contract.web3.eth.call(tx, tx.blockNumber);
	
			result = result.startsWith("0x") ? result : `0x${result}`;
	
			if (result && result.substr(138)) {
				const reason = contract.web3.utils.toAscii(result.substr(138));
				console.log("Revert reason:", reason);
				return reason;
			} else {
				console.log("Cannot get reason - No return value");
			}
		} catch (err) {
			console.error(err);
		}
	}

	function getStatusCodeName(statusCode, pretty = true) {
		let name = "";
		let keys = Object.keys(config.statusCodes);
		for (let i = 0; i < keys.length; ++i) {
			let statusCodeName = keys[i];
			if (statusCodeName in config.statusCodes) {
				if (statusCode == config.statusCodes[statusCodeName]) {
					name = statusCodeName;
					if (pretty)
						name = statusCodeName.replace("STATUS_CODE", "").replace(new RegExp(/_/, 'g'), ' ');
					else name = statusCodeName;
					return name;
				}
			}
		}
	}
})();
