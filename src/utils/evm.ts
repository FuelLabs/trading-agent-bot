import { concat, parseSignature, signatureToCompactSignature, type Hex } from "viem";
import { Account, Address, type HashableMessage, Provider } from "fuels";
import { Wallet } from "ethers";

interface EvmAccountAdapterConfig {
  evmWallet: Wallet;
  provider: Provider;
}

export function padTo32Bytes(address: string): string {
  // Remove '0x' if present
  const hex = address.startsWith("0x") ? address.slice(2) : address;
  return "0x" + hex.padStart(64, "0");
}

export class EvmAccountAdapter extends Account {
  readonly address: Address;
  private readonly wallet: Wallet;

  constructor(config: EvmAccountAdapterConfig) {
    super(padTo32Bytes(config.evmWallet.address), config.provider);
    this.wallet = config.evmWallet;
    this.address = new Address(padTo32Bytes(this.wallet.address));
  }

  async signMessage(message: HashableMessage): Promise<string> {
    if (typeof message === "string") {
      throw new Error("Invalid message to sign – expecting object of personal sign");
    }

    if (typeof message.personalSign === "string") {
      throw new Error("Invalid message to sign – expecting Uint8Array");
    }

    // Sign using EVM wallet (returns 65-byte signature: r + s + v)
    const signature = await this.wallet.signMessage(message.personalSign);

    // Keep only r + s (first 64 bytes) for FuelVM
    const compactSignature = signatureToCompactSignature(parseSignature(signature as Hex));

    return concat([compactSignature.r, compactSignature.yParityAndS]);
  }
}
