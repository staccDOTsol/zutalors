"use client"

import { WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { JupiterSwapForm } from '@/components/Jupiter'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

// Import the Solana Wallet Adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css'

const wallets = [new PhantomWalletAdapter()]

export default function Home() {
  return (
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <div className="min-h-screen bg-gray-900 text-white">
          <div className="container mx-auto max-w-6xl p-8 2xl:px-0">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold">Gobbler @ fomo3d.fun</h1>
              <WalletMultiButton className="!bg-gray-800 hover:!bg-gray-700 !text-white !font-semibold !py-2 !px-4 !rounded" />
            </div>
            <JupiterSwapForm />
          </div>
        </div>
      </WalletModalProvider>
    </WalletProvider>
  )
}