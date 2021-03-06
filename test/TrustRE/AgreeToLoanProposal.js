const TrustRE = artifacts.require('TrustRE');
const EntityFactory = artifacts.require('EntityFactory');
const TrusteeFactory = artifacts.require('TrusteeFactory');
const DexRE = artifacts.require('DexRE');
const Loan = artifacts.require('Loan');
const utils = require('../Utils');

contract('TrustRE', (accounts) => {
    let loanData = {
        amount: 1000000000000000000,
        interest: 5 * 100,
        due: 3 * utils.SECONDS_PER_DAY
    };

    describe('agreeToLoanProposal()', () => {
        it('verifies that only existing trust beneficiary can agree to loan proposal', async () => {
            let entityFactory = await EntityFactory.new();
            let trusteeFactory = await TrusteeFactory.new();
            let contract = await DexRE.new(entityFactory.address, trusteeFactory.address, {from: accounts[9]});
            await entityFactory.setDexRE(contract.address);
            await trusteeFactory.setDexRE(contract.address);
            let trustee = await trusteeFactory.newTrustee('Test Trustee', {from: accounts[2]});

            let entity = await entityFactory.newEntity(1, true, 'PH', {from: accounts[3]});
            let trust = await contract.newTrust(trustee.logs[0].args.trustee, 'Test Trust', 'Test Property', entity.logs[0].args.entity, {
                from: accounts[9]
            });
            let entity2 = await entityFactory.newEntity(1, true, 'PH', {from: accounts[4]});
            let trustContract = await TrustRE.at(trust.logs[0].args.trust);
            await trustContract.newBeneficiary(entity2.logs[0].args.entity, {from: accounts[3]});
            let loan = await trustContract.newLoanProposal(
              loanData.amount,
              loanData.interest,
              loanData.due,
              {from: accounts[3]}
            );

            try {
                await trustContract.agreeToLoanProposal(loan.logs[0].args.loan, {from: accounts[5]});
                assert(false, "didn't throw");
            }
            catch (error) {
                return utils.ensureException(error);
            }
        });

        it('verifies that it adds signature to loan proposal', async () => {
            let entityFactory = await EntityFactory.new();
            let trusteeFactory = await TrusteeFactory.new();
            let contract = await DexRE.new(entityFactory.address, trusteeFactory.address, {from: accounts[9]});
            await entityFactory.setDexRE(contract.address);
            await trusteeFactory.setDexRE(contract.address);
            let trustee = await trusteeFactory.newTrustee('Test Trustee', {from: accounts[2]});

            let entity = await entityFactory.newEntity(1, true, 'PH', {from: accounts[3]});
            let trust = await contract.newTrust(trustee.logs[0].args.trustee, 'Test Trust', 'Test Property', entity.logs[0].args.entity, {
                from: accounts[9]
            });
            let entity2 = await entityFactory.newEntity(1, true, 'PH', {from: accounts[4]});
            let entity3 = await entityFactory.newEntity(1, true, 'PH', {from: accounts[5]});
            let trustContract = await TrustRE.at(trust.logs[0].args.trust);
            await trustContract.newBeneficiary(entity2.logs[0].args.entity, {from: accounts[3]});
            let newBeneficiaryRes = await trustContract.newBeneficiary(entity3.logs[0].args.entity, {from: accounts[3]});
            await trustContract.agreeToAddBeneficiary(newBeneficiaryRes.logs[0].args.beneficiary, {from: accounts[4]});

            let loan = await trustContract.newLoanProposal(
              loanData.amount,
              loanData.interest,
              loanData.due,
              {from: accounts[3]}
            );

            let loanContract = await Loan.at(loan.logs[0].args.loan);
            let signaturesCount = await loanContract.countSignatures.call();
            assert.equal(signaturesCount, 1);
            await trustContract.agreeToLoanProposal(loan.logs[0].args.loan, {from: accounts[5]});
            signaturesCount = await loanContract.countSignatures.call();
            assert.equal(signaturesCount, 2);
        });

        it('verifies that trust have an active loan', async () => {
            let entityFactory = await EntityFactory.new();
            let trusteeFactory = await TrusteeFactory.new();
            let contract = await DexRE.new(entityFactory.address, trusteeFactory.address, {from: accounts[9]});
            await entityFactory.setDexRE(contract.address);
            await trusteeFactory.setDexRE(contract.address);
            let trustee = await trusteeFactory.newTrustee('Test Trustee', {from: accounts[2]});

            let entity = await entityFactory.newEntity(1, true, 'PH', {from: accounts[3]});
            let trust = await contract.newTrust(trustee.logs[0].args.trustee, 'Test Trust', 'Test Property', entity.logs[0].args.entity, {
                from: accounts[9]
            });
            let entity2 = await entityFactory.newEntity(1, true, 'PH', {from: accounts[4]});
            let entity3 = await entityFactory.newEntity(1, true, 'PH', {from: accounts[5]});
            let trustContract = await TrustRE.at(trust.logs[0].args.trust);
            await trustContract.newBeneficiary(entity2.logs[0].args.entity, {from: accounts[3]});
            let newBeneficiaryRes = await trustContract.newBeneficiary(entity3.logs[0].args.entity, {from: accounts[3]});
            await trustContract.agreeToAddBeneficiary(newBeneficiaryRes.logs[0].args.beneficiary, {from: accounts[4]});

            await trustContract.newLoanProposal(
              loanData.amount,
              loanData.interest,
              loanData.due,
              {from: accounts[3]}
            );
            await trustContract.newLoanProposal(
              loanData.amount,
              loanData.interest,
              loanData.due,
              {from: accounts[4]}
            );
            await trustContract.newLoanProposal(
              loanData.amount,
              loanData.interest,
              loanData.due,
              {from: accounts[5]}
            );
            let loan = await trustContract.newLoanProposal(
              loanData.amount,
              loanData.interest,
              loanData.due,
              {from: accounts[3]}
            );
            let loanContract = await TrustRE.at(loan.logs[0].args.loan);
            await trustContract.agreeToLoanProposal(loan.logs[0].args.loan, {from: accounts[5]});
            await trustContract.agreeToLoanProposal(loan.logs[0].args.loan, {from: accounts[4]});

            let activeLoan = await trustContract.activeLoan.call();
            assert.equal(activeLoan, loan.logs[0].args.loan);
            let loanAmount = await trustContract.loanAmount.call();
            assert.equal(Number(loanAmount), loanData.amount);
            let proposals = await trustContract.loanProposals.call();
            assert.equal(proposals.length, 0);
        });
    });
})
