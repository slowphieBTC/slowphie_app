import { Address } from '@btc-vision/transaction';
import { ABIDataTypes, BitcoinAbiTypes, BitcoinInterfaceAbi } from 'opnet';

export interface ColorClasses {
  gradient: string;
  glow: string;
  text: string;
  bg: string;
  border: string;
  bar: string;
}

export interface TokenConfig {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  address: string;
  abi: BitcoinInterfaceAbi;
  mintArgs: (bigint | Address)[];
  mintArgsFactory?: (address: Address) => (bigint | Address)[];
  mintFunctionName: string;
  mintPerCall: bigint;
  decimals: number;
  maxSupply: bigint;
  deployedAt: number;  // Unix timestamp ms
  colorClasses: ColorClasses;
}

const makeReadAbi = () => [
  {
    name: 'name',
    type: BitcoinAbiTypes.Function,
    constant: true,
    inputs: [],
    outputs: [{ name: 'name', type: ABIDataTypes.STRING }],
  },
  {
    name: 'symbol',
    type: BitcoinAbiTypes.Function,
    constant: true,
    inputs: [],
    outputs: [{ name: 'symbol', type: ABIDataTypes.STRING }],
  },
  {
    name: 'decimals',
    type: BitcoinAbiTypes.Function,
    constant: true,
    inputs: [],
    outputs: [{ name: 'decimals', type: ABIDataTypes.UINT8 }],
  },
  {
    name: 'totalSupply',
    type: BitcoinAbiTypes.Function,
    constant: true,
    inputs: [],
    outputs: [{ name: 'totalSupply', type: ABIDataTypes.UINT256 }],
  },
  {
    name: 'maximumSupply',
    type: BitcoinAbiTypes.Function,
    constant: true,
    inputs: [],
    outputs: [{ name: 'maximumSupply', type: ABIDataTypes.UINT256 }],
  },
  {
    name: 'balanceOf',
    type: BitcoinAbiTypes.Function,
    constant: true,
    inputs: [{ name: 'account', type: ABIDataTypes.ADDRESS }],
    outputs: [{ name: 'balance', type: ABIDataTypes.UINT256 }],
  },
];

export const MONEY_TOKEN: TokenConfig = {
  id: 'money',
  name: '$MONEY',
  symbol: 'MONEY',
  icon: '💵',
  address: '0xd0e5def804a309471393c36cbfdc02f65dc977c51264fcef05fa495585d9d311',
  abi: [
    {
      name: 'publicMint',
      type: BitcoinAbiTypes.Function,
      constant: false,
      payable: false,
      inputs: [],
      outputs: [{ name: 'success', type: ABIDataTypes.BOOL }],
    },
    ...makeReadAbi(),
  ] as BitcoinInterfaceAbi,
  mintFunctionName: 'publicMint',
  mintArgs: [],
  mintPerCall: 100_000_000_000_000n,
  decimals: 8,
  maxSupply: 2_100_000_000_000_000_000n,
  deployedAt: 1742679053000,
  colorClasses: {
    gradient: 'from-green-400 to-emerald-600',
    glow: 'glow-green',
    text: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    bar: 'bg-gradient-to-r from-green-400 to-emerald-500',
  },
};

export const BIP110_TOKEN: TokenConfig = {
  id: 'bip110',
  name: '$BIP110',
  symbol: 'BIP110',
  icon: '🪙',
  address: '0xe9f91d5fd91124ffb1f9a4846599a28236c3a7676d60c778027aa28ed27fe268',
  abi: [
    {
      name: 'mint',
      type: BitcoinAbiTypes.Function,
      constant: false,
      payable: false,
      inputs: [],
      outputs: [],
    },
    ...makeReadAbi(),
  ] as BitcoinInterfaceAbi,
  mintFunctionName: 'mint',
  mintArgs: [],
  mintPerCall: 11_000_000_000n,
  decimals: 8,
  maxSupply: 11_000_000_000_000n,
  deployedAt: 1742692450000,
  colorClasses: {
    gradient: 'from-purple-400 to-indigo-600',
    glow: 'glow-purple',
    text: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    bar: 'bg-gradient-to-r from-purple-400 to-indigo-500',
  },
};

export const SWAP_TOKEN: TokenConfig = {
  id: 'swap',
  name: '$SWAP',
  symbol: 'SWAP',
  icon: '🔄',
  address: '0xb4be035ad7e09d72b57ba5e1a28b70ec281991dab106833bd1a9e7642bb1f599',
  abi: [
    {
      name: 'freeMint',
      type: BitcoinAbiTypes.Function,
      constant: false,
      payable: false,
      inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
      outputs: [],
    },
    ...makeReadAbi(),
  ] as BitcoinInterfaceAbi,
  mintFunctionName: 'freeMint',
  mintArgs: [1_000_000_000_000_000_000_000n],
  mintPerCall: 1_000_000_000_000_000_000_000n,
  decimals: 18,
  maxSupply: 1_000_000_000_000_000_000_000_000n,
  deployedAt: 1742871285000,
  colorClasses: {
    gradient: 'from-blue-400 to-cyan-500',
    glow: 'glow-blue',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    bar: 'bg-gradient-to-r from-blue-400 to-cyan-500',
  },
};

export const TESTICLE_TOKEN: TokenConfig = {
  id: 'testicle',
  name: '$TESTICLE',
  symbol: 'TESTICLE',
  icon: '🥜',
  address: '0xa29e6baa2b9202f4a7b935960f166d8fa96ff018eb004f09571a39b1e98a5f51',
  abi: [
    {
      name: 'freeMint',
      type: BitcoinAbiTypes.Function,
      constant: false,
      payable: false,
      inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
      outputs: [],
    },
    ...makeReadAbi(),
  ] as BitcoinInterfaceAbi,
  mintFunctionName: 'freeMint',
  mintArgs: [10_000_000_000_000_000_000_000n],
  mintPerCall: 10_000_000_000_000_000_000_000n,
  decimals: 18,
  maxSupply: 1_000_000_000_000_000_000_000_000n,
  deployedAt: 1742863635000,
  colorClasses: {
    gradient: 'from-orange-400 to-red-500',
    glow: 'glow-orange',
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    bar: 'bg-gradient-to-r from-orange-400 to-red-500',
  },
};

export const SAT_TOKEN: TokenConfig = {
  id: 'sat',
  name: 'SATOSHI',
  symbol: 'SAT',
  icon: '🌟',
  address: '0xb2d6af9d8e923ad794edaaf04bf0d3a4ac11b4302e009801f75ea7cd86de7035',
  abi: [
    {
      name: 'freeMint',
      type: BitcoinAbiTypes.Function,
      constant: false,
      payable: false,
      inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
      outputs: [],
    },
    ...makeReadAbi(),
  ] as BitcoinInterfaceAbi,
  mintFunctionName: 'freeMint',
  mintArgs: [1_000_000_000_000_000_000_000n],
  mintPerCall: 1_000_000_000_000_000_000_000n,
  decimals: 18,
  maxSupply: 1_000_000_000_000_000_000_000_000_000n,
  deployedAt: 1742863635000,
  colorClasses: {
    gradient: 'from-yellow-400 to-amber-500',
    glow: 'glow-yellow',
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    bar: 'bg-gradient-to-r from-yellow-400 to-amber-500',
  },
};

export const MOTOD_TOKEN: TokenConfig = {
  id: 'motod',
  name: 'motodog',
  symbol: 'MOTOD',
  icon: '🐶',
  address: '0x7155b2a8ed908db67aec60941f5811fe5ea8c37ae49a13cbeddf7c26ee83ba86',
  abi: [
    {
      name: 'freeMint',
      type: BitcoinAbiTypes.Function,
      constant: false,
      payable: false,
      inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
      outputs: [],
    },
    ...makeReadAbi(),
  ] as BitcoinInterfaceAbi,
  mintFunctionName: 'freeMint',
  mintArgs: [1_000_000_000_000_000_000_000n],
  mintPerCall: 1_000_000_000_000_000_000_000n,
  decimals: 18,
  maxSupply: 21_000_000_000_000_000_000_000_000n,
  deployedAt: 1743488981000,
  colorClasses: {
    gradient: 'from-teal-400 to-cyan-500',
    glow: 'glow-teal',
    text: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    bar: 'bg-gradient-to-r from-teal-400 to-cyan-500',
  },
};

export const BITS_TOKEN: TokenConfig = {
  id: 'bits',
  name: 'Bit Scarce',
  symbol: 'BITS',
  icon: '💎',
  address: '0x7b4d31094100632288619bbe5285ae9755b7e1acb62270f467c72d1564758652',
  abi: [
    {
      name: 'freeMint',
      type: BitcoinAbiTypes.Function,
      constant: false,
      payable: false,
      inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
      outputs: [],
    },
    ...makeReadAbi(),
  ] as BitcoinInterfaceAbi,
  mintFunctionName: 'freeMint',
  mintArgs: [9_900_000_000_000_000_000_000n],
  mintPerCall: 9_900_000_000_000_000_000_000n,
  decimals: 18,
  maxSupply: 10_500_000_000_000_000_000_000_000n,
  deployedAt: 1743502958000,
  colorClasses: {
    gradient: 'from-rose-400 to-pink-500',
    glow: 'glow-rose',
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    bar: 'bg-gradient-to-r from-rose-400 to-pink-500',
  },
};


export const ANIME_TOKEN: TokenConfig = {
  id: 'anime',
  name: 'anime Bitcoin',
  symbol: 'anime',
  icon: '🎌',
  address: '0x76d1fa6189e2fbf779097bab9b57fec0926cbac3456e238921f995cfc4ad4122',
  abi: [
    {
      name: 'freeMint',
      type: BitcoinAbiTypes.Function,
      constant: false,
      payable: false,
      inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
      outputs: [],
    },
    ...makeReadAbi(),
  ] as BitcoinInterfaceAbi,
  mintFunctionName: 'freeMint',
  mintArgs: [1_000_000_000_000_000_000n],
  mintPerCall: 1_000_000_000_000_000_000n,
  decimals: 18,
  maxSupply: 69_420_000_000_000_000_000_000n,
  deployedAt: 1743513290000,
  colorClasses: {
    gradient: 'from-indigo-400 to-violet-500',
    glow: 'glow-indigo',
    text: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    bar: 'bg-gradient-to-r from-indigo-400 to-violet-500',
  },
};

export const PEPE_TOKEN: TokenConfig = {
  id: 'pepe',
  name: 'Pepe',
  symbol: 'Pepe',
  icon: '🐸',
  address: '0xe709ccf7532424262bcb200e9aae6908871bae2b91888215cdc1e02c5a626b2a',
  abi: [
    {
      name: 'freeMint',
      type: BitcoinAbiTypes.Function,
      constant: false,
      payable: false,
      inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
      outputs: [],
    },
    ...makeReadAbi(),
  ] as BitcoinInterfaceAbi,
  mintFunctionName: 'freeMint',
  mintArgs: [1_000_000_000_000_000_000_000n],
  mintPerCall: 1_000_000_000_000_000_000_000n,
  decimals: 18,
  maxSupply: 21_000_000_000_000_000_000_000_000n,
  deployedAt: 1743490414000,
  colorClasses: {
    gradient: 'from-lime-400 to-green-500',
    glow: 'glow-lime',
    text: 'text-lime-400',
    bg: 'bg-lime-500/10',
    border: 'border-lime-500/20',
    bar: 'bg-gradient-to-r from-lime-400 to-green-500',
  },
};

export const PUSSY_TOKEN: TokenConfig = {
  id: 'pussy',
  name: 'Inu Pussy',
  symbol: 'PUSSY',
  icon: '🐱',
  address: '0x650af1a45def27c6fc885c1e43eff92c34c40fe23262a971881eeba1c884c345',
  abi: [
    {
      name: 'freeMint',
      type: BitcoinAbiTypes.Function,
      constant: false,
      payable: false,
      inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
      outputs: [],
    },
    ...makeReadAbi(),
  ] as BitcoinInterfaceAbi,
  mintFunctionName: 'freeMint',
  mintArgs: [50_000_000_000_000_000_000_000n],
  mintPerCall: 50_000_000_000_000_000_000_000n,
  decimals: 18,
  maxSupply: 21_000_000_000_000_000_000_000_000_000n,
  deployedAt: 1742926555000,
  colorClasses: {
    gradient: 'from-fuchsia-400 to-pink-500',
    glow: 'glow-fuchsia',
    text: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/20',
    bar: 'bg-gradient-to-r from-fuchsia-400 to-pink-500',
  },
};

export const OPKILL_TOKEN: TokenConfig = {
  id: 'opkill',
  name: 'OpKill',
  symbol: 'OPKILL',
  icon: '⚔️',
  address: '0xc537b2d11e3bc9eef4526a7162bbded9bd5f7f28ecfc69e173a15973ebce70c6',
  abi: [
    {
      name: 'batchMint',
      type: BitcoinAbiTypes.Function,
      constant: false,
      payable: false,
      inputs: [{ name: 'amount', type: ABIDataTypes.UINT256 }],
      outputs: [],
    },
    ...makeReadAbi(),
  ] as BitcoinInterfaceAbi,
  mintFunctionName: 'batchMint',
  mintArgs: [1n],
  mintPerCall: 25_000_000_000_000_000_000_000n,
  decimals: 18,
  maxSupply: 1_000_000_000_000_000_000_000_000_000n,
  colorClasses: {
    gradient: 'from-red-400 to-orange-500',
    glow: 'glow-red',
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    bar: 'bg-gradient-to-r from-red-400 to-orange-500',
  },
};

export const LUKE_TOKEN: TokenConfig = {
  id: 'luke_dash_jr',
  name: 'LukeDashJr',
  symbol: 'LUKE_DASH_JR',
  icon: '🧙',
  address: '0x03843bcaebae51d4474832e6f81ffcda2655fd9fa33517ff979f659866f14b70',
  abi: [
    {
      name: 'mint',
      type: BitcoinAbiTypes.Function,
      constant: false,
      payable: false,
      inputs: [
        { name: 'to', type: ABIDataTypes.ADDRESS },
        { name: 'amount', type: ABIDataTypes.UINT256 },
      ],
      outputs: [],
    },
    ...makeReadAbi(),
  ] as BitcoinInterfaceAbi,
  mintFunctionName: 'mint',
  mintArgs: [],
  mintArgsFactory: (address: Address) => [address, 1_000_000_000_000_000_000_000_000n],
  mintPerCall: 1_000_000_000_000_000_000_000_000n,
  decimals: 18,
  maxSupply: 21_000_000_000_000_000_000_000_000n,
  colorClasses: {
    gradient: 'from-cyan-400 to-sky-500',
    glow: 'glow-cyan',
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    bar: 'bg-gradient-to-r from-cyan-400 to-sky-500',
  },
};

export const TOKENS: TokenConfig[] = [MONEY_TOKEN, BIP110_TOKEN, SWAP_TOKEN, TESTICLE_TOKEN, SAT_TOKEN, MOTOD_TOKEN, BITS_TOKEN, ANIME_TOKEN, PEPE_TOKEN, PUSSY_TOKEN];
