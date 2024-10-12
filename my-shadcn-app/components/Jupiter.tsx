"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { createJupiterApiClient } from "@jup-ag/api"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowDownUp, Search } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Connection, VersionedTransaction } from "@solana/web3.js"

const jupiterApi = createJupiterApiClient({ basePath: "https://superswap.fomo3d.fun" })

interface TokenInfo {
  address: string;
  balance?: number;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
}

export function JupiterSwapForm() {
  const wallet = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [formValue, setFormValue] = useState({
    amount: "1",
    inputMint: "",
    outputMint: "",
    slippage: 0.5,
  })
  const [quoteResponse, setQuoteResponse] = useState<any>(null)
  const [searchInput, setSearchInput] = useState("")
  const [searchOutput, setSearchOutput] = useState("")
  const [isInputSelectOpen, setIsInputSelectOpen] = useState(false)
  const [isOutputSelectOpen, setIsOutputSelectOpen] = useState(false)

  useEffect(() => {
    const fetchTokens = async () => {
      if (!wallet.publicKey) return;

      try {
        let allTokens: TokenInfo[] = [];
        let page = 1;
        const limit = 100;
        let hasMore = true;

        while (hasMore) {
          const response = await fetch('https://mainnet.helius-rpc.com/?api-key=0d4b4fd6-c2fc-4f55-b615-a23bab1ffc85', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: `page-${page}`,
              method: 'getAssetsByOwner',
              params: {
                ownerAddress: wallet.publicKey.toBase58(),
                page: page,
                limit: limit,
                displayOptions: {
                  showFungible: true
                }
              },
            }),
          });

          const { result } = await response.json();
          
          if (result.items.length === 0) {
            hasMore = false;
          } else {
            const pageTokens = result.items
              .filter((item: any) => item.interface === 'FungibleToken' || item.interface === 'FungibleAsset')
              .map((token: any) => {
                if (!token.content.links?.image) {
                  return null;
                }
                return {
                  address: token.id,
                  symbol: token.content.metadata?.symbol || '',
                  name: token.content.metadata?.name || '',
                  decimals: token.token_info?.decimals || 0,
                  logoURI: token.content.links.image,
                  balance: token.token_info?.balance || '0'
                };
              });

            allTokens = [...allTokens, ...pageTokens];
            
            if (page === 1 && pageTokens.length > 1) {
              setFormValue(prev => ({
                ...prev,
                inputMint: "So11111111111111111111111111111111111111112",
                outputMint: "BQpGv6LVWG1JRm1NdjerNSFdChMdAULJr3x9t2Swpump"
              }));
            }
            
            setTokens(allTokens.filter(token => token !== null));
            page++;
          }
        }

        setTokens(allTokens.filter(token => token !== null));
      } catch (error) {
        console.error("Failed to fetch tokens:", error);
      }
    };
    fetchTokens()
  }, [wallet, wallet.publicKey])

  const inputToken = useMemo(() => tokens.find(t => t.address === formValue.inputMint), [tokens, formValue.inputMint])
  const outputToken = useMemo(() => tokens.find(t => t.address === formValue.outputMint), [tokens, formValue.outputMint])
  const endpoint = "https://rpc.ironforge.network/mainnet?apiKey=01HRZ9G6Z2A19FY8PR4RF4J4PW"
  const connection = new Connection(endpoint)
  const fetchQuote = useCallback(async () => {
    if (!inputToken || !outputToken) return
    setIsLoading(true)
    try {
      const amount = (parseFloat(formValue.amount) * (10 ** inputToken.decimals)).toString()
      const quote = await jupiterApi.quoteGet({
        inputMint: formValue.inputMint,
        outputMint: formValue.outputMint,
        amount: Number(amount),
        slippageBps: formValue.slippage * 100,
      })
      setQuoteResponse(quote)
    } catch (error) {
      console.error("Failed to fetch quote:", error)
    }
    setIsLoading(false)
  }, [formValue, inputToken, outputToken])

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (formValue.inputMint && formValue.outputMint && formValue.amount) {
        fetchQuote()
      }
    }, 500) // Debounce for 500ms

    return () => clearTimeout(debounceTimer)
  }, [formValue.amount, formValue.inputMint, formValue.outputMint, fetchQuote])

  const handleSwap = async () => {
    if (!quoteResponse || !wallet.publicKey || !wallet.signTransaction) return

    try {
      const swapResult = await jupiterApi.swapPost({
        swapRequest: {
        userPublicKey: wallet.publicKey.toBase58(),
        quoteResponse},
      })
      console.log("Swap transaction created:", swapResult)
      // Deserialize the transaction
      const swapTransactionBuf = Buffer.from(swapResult.swapTransaction, 'base64');
      const transaction = await wallet.signTransaction(VersionedTransaction.deserialize(swapTransactionBuf));
      
      
      // Get the latest blockhash
      const latestBlockhash = await connection.getLatestBlockhash();
      
      // Execute the transaction
      const rawTransaction = transaction.serialize()
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2
      });
      
      // Confirm the transaction
      await connection.confirmTransaction({
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature: txid
      });
      
      console.log(`Swap transaction successful: https://solscan.io/tx/${txid}`);
    } catch (error) {
      console.error("Swap failed:", error)
    }
  }

  const switchTokens = () => {
    setFormValue(prev => ({
      ...prev,
      inputMint: prev.outputMint,
      outputMint: prev.inputMint,
      amount: quoteResponse ? (parseFloat(quoteResponse.outAmount) / (10 ** outputToken!.decimals)).toString() : prev.amount
    }))
    setSearchInput("")
    setSearchOutput("")
  }

  const formatBalance = (balance: number | undefined, decimals: number) => {
    if (balance === undefined) return "0"
    return (balance / (10 ** decimals)).toFixed(decimals)
  }

  const filteredInputTokens = useMemo(() => tokens.filter(token => 
    token.symbol.toLowerCase().includes(searchInput.toLowerCase()) ||
    token.name.toLowerCase().includes(searchInput.toLowerCase())
  ), [tokens, searchInput])

  const filteredOutputTokens = useMemo(() => tokens.filter(token => 
    token.symbol.toLowerCase().includes(searchOutput.toLowerCase()) ||
    token.name.toLowerCase().includes(searchOutput.toLowerCase())
  ), [tokens, searchOutput])

  return (
    <Card className="w-full max-w-md mx-auto bg-neutral text-neutral-content">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">SuperSwap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Search input tokens..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-grow"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsInputSelectOpen(!isInputSelectOpen)}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {isInputSelectOpen && (
            <ScrollArea className="h-[200px] border rounded-md p-2">
              {filteredInputTokens.map((token) => (
                <Button
                  key={token.address}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setFormValue((prev) => ({ ...prev, inputMint: token.address }))
                    setIsInputSelectOpen(false)
                  }}
                >
                  <img src={token.logoURI} alt={token.symbol} className="w-6 h-6 mr-2" />
                  <span>{token.symbol}</span>
                </Button>
              ))}
            </ScrollArea>
          )}
          <Input
            type="number"
            placeholder="0.00"
            value={formValue.amount}
            onChange={(e) => setFormValue((prev) => ({ ...prev, amount: e.target.value }))}
          />
          {inputToken && (
            <div className="text-sm">
              Balance: {formatBalance(inputToken.balance, inputToken.decimals)} {inputToken.symbol}
            </div>
          )}
        </div>
        <div className="flex justify-center">
          <Button variant="outline" size="icon" className="rounded-full" onClick={switchTokens}>
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Search output tokens..."
              value={searchOutput}
              onChange={(e) => setSearchOutput(e.target.value)}
              className="flex-grow"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsOutputSelectOpen(!isOutputSelectOpen)}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {isOutputSelectOpen && (
            <ScrollArea className="h-[200px] border rounded-md p-2">
              {filteredOutputTokens.map((token) => (
                <Button
                  key={token.address}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    setFormValue((prev) => ({ ...prev, outputMint: token.address }))
                    setIsOutputSelectOpen(false)
                  }}
                >
                  <img src={token.logoURI} alt={token.symbol} className="w-6 h-6 mr-2" />
                  <span>{token.symbol}</span>
                </Button>
              ))}
            </ScrollArea>
          )}
          <Input
            type="number"
            placeholder="0.00"
            value={quoteResponse ? (parseFloat(quoteResponse.outAmount) / (10 ** outputToken!.decimals)).toFixed(outputToken!.decimals) : ""}
            readOnly
          />
          {outputToken && (
            <div className="text-sm">
              Balance: {formatBalance(outputToken.balance, outputToken.decimals)} {outputToken.symbol}
            </div>
          )}
        </div>
        {quoteResponse && inputToken && outputToken && (
          <div className="text-sm">
            Rate: 1 {inputToken.symbol} = 
            {(parseFloat(quoteResponse.outAmount) / (10 ** outputToken.decimals) / parseFloat(formValue.amount)).toFixed(6)} {outputToken.symbol}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleSwap} disabled={isLoading || !quoteResponse}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            "Swap"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}