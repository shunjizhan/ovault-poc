import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Options } from '@layerzerolabs/lz-v2-utilities';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import inquirer from 'inquirer';

task('ovaultv2', 'Interactive CLI for OVaultV2 contract (deposit or withdraw)')
  .setAction(async (_, hre: HardhatRuntimeEnvironment) => {
    try {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Select action:',
          choices: ['deposit', 'withdraw'],
        },
      ]);

      // Get amount
      const { amount } = await inquirer.prompt([
        {
          type: 'input',
          name: 'amount',
          message: 'Enter amount:',
          validate: function (input) {
            const num = Number(input);
            return !isNaN(num) && num > 0 ? true : 'Please enter a valid positive number';
          },
        },
      ]);

      // If withdraw action, get recipient address
      let recipient;
      if (action === 'withdraw') {
        const { recipientAddress } = await inquirer.prompt([
          {
            type: 'input',
            name: 'recipientAddress',
            message: 'Enter recipient address (leave empty to use your address):',
            default: '',
          },
        ]);
        recipient = recipientAddress;
      }

      console.log(`\nPerforming ${action} with amount: ${amount}`);

      // Connect to the network
      const [signer] = await hre.ethers.getSigners();
      console.log(`Connected with address: ${signer.address}`);
      console.log(`Network: ${hre.network.name}`);

      // Set recipient to signer address if empty
      if (action === 'withdraw' && (!recipient || recipient === '')) {
        recipient = signer.address;
      }

      // Get the deployed OVaultV2 contract
      const ovaultV2Deployment = await hre.deployments.get('OVaultV2');
      const ovaultV2Address = ovaultV2Deployment.address;
      console.log(`OVaultV2 contract address: ${ovaultV2Address}`);

      // Connect to the OVaultV2 contract
      const ovaultV2 = await hre.ethers.getContractAt('OVaultV2', ovaultV2Address, signer);

      // For OVaultV2, get the OUsdt contract for deposit action
      let oUsdtContract;
      if (action === 'deposit') {
        // Get OUsdt contract address from OVaultV2
        const oUsdtAddress = await ovaultV2.ousdt();
        console.log(`OUsdt contract address: ${oUsdtAddress}`);

        // Connect to OUsdt contract
        oUsdtContract = await hre.ethers.getContractAt('OUsdt', oUsdtAddress, signer);

        // Check OUsdt balance
        const balance = await oUsdtContract.balanceOf(signer.address);
        console.log(`Current OUsdt balance: ${hre.ethers.utils.formatUnits(balance, 18)} OUSDT`);

        // If insufficient balance, mint some tokens (assuming the user has minting rights)
        const amountWei = hre.ethers.utils.parseUnits(amount.toString(), 18);
        if (balance.lt(amountWei)) {
          const { mint } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'mint',
              message: 'Insufficient balance. Would you like to mint tokens?',
              default: true,
            },
          ]);

          if (mint) {
            console.log(`Minting ${amount} OUSDT...`);
            const mintTx = await oUsdtContract.mint(signer.address, amountWei);
            await mintTx.wait();
            console.log(`Minted ${amount} OUSDT`);

            const newBalance = await oUsdtContract.balanceOf(signer.address);
            console.log(`New balance: ${hre.ethers.utils.formatUnits(newBalance, 18)} OUSDT`);
          }
        }
      }

      // Get quote for the operation
      console.log('Getting fee quote...');
      let nativeFee;
      let options;
      if (action === 'deposit') {
        options = Options.newOptions()
          .addExecutorLzReceiveOption(200000, parseEther('0.003').toBigInt())
          .addExecutorComposeOption(0, 200000)
          .toBytes();
        nativeFee = await ovaultV2.quoteDeposit(parseEther(amount), options);
      } else {
        options = Options.newOptions()
          .addExecutorLzReceiveOption(500000, parseEther('0.003').toBigInt())
          .toBytes();
        const fee = await ovaultV2.quoteWithdraw(
          recipient,
          parseEther(amount),
          options
        );
        nativeFee = fee.nativeFee;
      }

      console.log(`Fee: ${formatEther(nativeFee)} ETH`);

      // Confirm transaction
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Proceed with transaction?',
          default: true,
        },
      ]);

      if (!confirm) {
        console.log('Transaction cancelled.');
        return;
      }

      // Execute the transaction
      console.log(`Sending ${action} transaction...`);
      let tx;

      if (action === 'deposit') {
        // First approve OVaultV2 to spend OUSDT
        const amountWei = parseEther(amount);
        const currentAllowance = await oUsdtContract!.allowance(signer.address, ovaultV2Address);

        if (currentAllowance.lt(amountWei)) {
          console.log('Approving OVaultV2 to spend OUSDT...');
          const approveTx = await oUsdtContract!.approve(ovaultV2Address, amountWei);
          await approveTx.wait();
          console.log('Approval transaction confirmed');
        }

        // Now deposit
        tx = await ovaultV2.deposit(amountWei, options, { value: nativeFee });
      } else {
        // Withdraw
        tx = await ovaultV2.withdraw(
          recipient,
          parseEther(amount),
          options,
          { value: nativeFee }
        );
      }

      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
      console.log(`Check message status: https://testnet.layerzeroscan.com/tx/${receipt.transactionHash}`);

    } catch (error: unknown) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

export default {};
