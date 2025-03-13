export const CONTRACT_ABI = [
  // YourContract functions
  {
    inputs: [],
    name: "counter",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "increment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // CandyCrushGame functions
  {
    inputs: [
      {
        internalType: "uint8",
        name: "x",
        type: "uint8",
      },
      {
        internalType: "uint8",
        name: "y",
        type: "uint8",
      },
      {
        internalType: "uint8",
        name: "candyType",
        type: "uint8",
      },
    ],
    name: "recordMatch",
    outputs: [
      {
        internalType: "bool",
        name: "success",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "player",
        type: "address",
      },
    ],
    name: "getPlayerScore",
    outputs: [
      {
        internalType: "uint256",
        name: "score",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "player",
        type: "address",
      },
    ],
    name: "getMatchesMade",
    outputs: [
      {
        internalType: "uint256",
        name: "matches",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint8",
        name: "x",
        type: "uint8",
      },
      {
        internalType: "uint8",
        name: "y",
        type: "uint8",
      },
    ],
    name: "getCandyAt",
    outputs: [
      {
        internalType: "uint8",
        name: "candyType",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint8[8][8]",
        name: "newBoard",
        type: "uint8[8][8]",
      },
    ],
    name: "updateGameBoard",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
