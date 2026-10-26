// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title Hemi's Graveyard - score registry (Hemi Mainnet)
/// @notice Free to play. Players only pay network gas to record a winning run.
contract HemiGraveyardScores {
    struct Best {
        uint32 score;
        uint16 graves;
        uint16 kills;
        uint32 time;
        string name;
    }

    mapping(address => Best) public best;
    uint256 public totalSubmissions;

    event ScoreSubmitted(
        address indexed player,
        string name,
        uint32 score,
        uint16 graves,
        uint16 kills,
        uint32 time
    );

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
