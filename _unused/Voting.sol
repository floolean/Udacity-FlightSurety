pragma solidity ^0.8.11;

contract Voting  {

	string private proposal;
	uint private minVotes;
	address[] private votes;
	uint private endTimestamp;
	bool public created;

	constructor (string memory _proposal, uint _minVotes, uint _endTimestamp)
	{
		proposal = _proposal;
		minVotes = _minVotes;
		endTimestamp = _endTimestamp;
		created = true;
	}

	function vote(address voter) external 
	{
		if (endTimestamp > 0)
		{
			require(endTimestamp > block.timestamp, "Voting on this proposal ended");
		}
    for(uint i = 0; i < votes.length; i++) {
			address addr = votes[i];
			require(addr != voter, "Voter has already voted on proposal");
			votes.push(voter);
    }
	}

	function passed() external view returns (bool)
	{
		return votes.length >= minVotes;
	}

	function getProposal() external view returns (string memory)
	{
		return proposal;
	}

	function getVoteCount() external view returns (uint)
	{
		return votes.length;
	}

	function reset(uint newTimestamp) external 
	{
		delete votes;
		endTimestamp = newTimestamp;
	}

}