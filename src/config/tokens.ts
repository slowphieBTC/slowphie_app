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
  mintArgs: bigint[];
  mintFunctionName: string;
  mintPerCall: bigint;
  decimals: number;
  maxSupply: bigint;
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
  colorClasses: {
    gradient: 'from-orange-400 to-red-500',
    glow: 'glow-orange',
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    bar: 'bg-gradient-to-r from-orange-400 to-red-500',
  },
};

export const TOKENS: TokenConfig[] = [MONEY_TOKEN, BIP110_TOKEN, SWAP_TOKEN, TESTICLE_TOKEN];
