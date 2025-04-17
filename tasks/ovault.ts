import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Options } from '@layerzerolabs/lz-v2-utilities';
import { task } from 'hardhat/config';
import inquirer from 'inquirer';

// import { OVault__factory } from '../typechain-types';

// Using the same task-based approach as the existing ovault.ts
task('ovault', 'Interactive CLI for OVault contract (deposit or withdraw)')
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

      console.log(`\nPerforming ${action} with amount: ${amount}`);

      // Connect to the network
      const [signer] = await hre.ethers.getSigners();
      console.log(`Connected with address: ${signer.address}`);
      console.log(`Network: ${hre.network.name}`);

      // Get the deployed OVault contract
      const ovaultDeployment = await hre.deployments.get('OVault');
      const ovaultAddress = ovaultDeployment.address;
      console.log(`OVault contract address: ${ovaultAddress}`);

      // Connect to the OVault contract with proper typing using OVault__factory
      const ovault = await hre.ethers.getContractAt('OVault', ovaultAddress, signer);

      // Create options for the message
      const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex();

      // Determine action type for message
      const actionType = action === 'deposit' ? 'DEPOSIT' : 'WITHDRAW';

      // Get quote for the message
      console.log('Getting fee quote...');
      const [nativeFee] = await ovault.quote(actionType, amount, options);
      console.log(`Fee: ${hre.ethers.utils.formatEther(nativeFee)} ETH`);

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
        tx = await ovault.deposit(amount, options, { value: nativeFee });
      } else {
        tx = await ovault.requestWithdraw(amount, options, { value: nativeFee });
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
