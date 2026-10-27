// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title Hemi's Graveyard - score registry v2 (Hemi Mainnet)
/// @notice Free to play. Players only pay network gas: once to start a run, once to record a winning run.
contract HemiGraveyardScores {
    struct Best {
        uint32 score;
        uint16 graves;
        uint16 kills;
        uint32 time;
        string name;
    }

    mapping(address => Best) public best;
    mapping(address => uint256) public startsOf;   // how many runs each wallet has started
    uint256 public totalSubmissions;               // winning scores recorded
    uint256 public totalStarts;                    // runs started

    event GameStarted(address indexed player, string name, uint256 startNumber);

    event ScoreSubmitted(
        address indexed player,
        string name,
        uint32 score,
        uint16 graves,
        uint16 kills,
        uint32 time
    );

    /// @notice Called when a player presses "Enter the Graveyard".
    function startGame(string calldata name) external {
        require(bytes(name).length > 0 && bytes(name).length <= 20, "bad name");

        totalStarts += 1;
        startsOf[msg.sender] += 1;

        emit GameStarted(msg.sender, name, startsOf[msg.sender]);
    }

    /// @notice Called when a player wins and submits their score.
    function submitScore(
        string calldata name,
        uint32 score,
        uint16 graves,
        uint16 kills,
        uint32 time
    ) external {
        require(bytes(name).length > 0 && bytes(name).length <= 20, "bad name");
        require(graves <= 5, "bad graves");

        totalSubmissions += 1;

        Best storage b = best[msg.sender];
        if (score > b.score) {
            b.score = score;
            b.graves = graves;
            b.kills = kills;
            b.time = time;
            b.name = name;
        }

        emit ScoreSubmitted(msg.sender, name, score, graves, kills, time);
    }
}

