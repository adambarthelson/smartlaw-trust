pragma solidity ^0.4.15;

import { EntityFactory } from './EntityFactory.sol';
import { Entity } from './Entity.sol';
import { TrustRE } from './TrustRE.sol';
import './Owned.sol';

contract SmartTrustRE is Owned {
  bool public status; // disable or enable contract
  address public entityFactory;

  address[] public trusts;

  event TrustCreated(address trust);

  function SmartTrustRE(address _entityFactory)
      public
      Owned(msg.sender)
  {
      status = true;
      entityFactory = _entityFactory;
  }

  modifier lawActive() {
      require(status);
      _;
  }

  function setEntityFactory(address _address)
      public
      ownerOnly
  {
      entityFactory = _address;
  }

  function trustAddresses()
      public
      lawActive
      constant returns(address[])
  {
      return trusts;
  }

  function updateStatus(bool _disable)
      public
      ownerOnly
  {
      status = _disable;
  }

  function verifyEntity(address _entity)
      public
      lawActive
      ownerOnly
  {
      EntityFactory entityFactoryInstance = EntityFactory(entityFactory);
      require(entityFactoryInstance.isEntity(_entity));
      Entity entity = Entity(_entity);
      entity.verify();
  }

  function newTrust(string _name, string _property, address _beneficiary)
      public
      lawActive
      ownerOnly
  {
      EntityFactory entityFactoryInstance = EntityFactory(entityFactory);
      require(entityFactoryInstance.isEntity(_beneficiary));
      TrustRE trust = new TrustRE(_name, _property, _beneficiary);
      trusts.push(trust);
      TrustCreated(trust);
  }

  /**
   * @dev allows entity to withdraw, should be called only from entity contract
   */
  function withdraw()
      public
  {
      EntityFactory entityFactoryInstance = EntityFactory(entityFactory);
      require(entityFactoryInstance.isEntity(msg.sender));
      address _owner = entityFactoryInstance.entityOwner(msg.sender);
      require(_owner != 0x0);
      Entity entity = Entity(msg.sender);
      uint funds = entity.availableFunds();
      if(_owner.send(funds)) {
          entity.sweepFunds();
      }
  }

  function senderEntity()
      private
      constant returns (address)
  {
      EntityFactory entityFactoryInstance = EntityFactory(entityFactory);
      require(entityFactoryInstance.isEntityOwner(msg.sender));
      return entityFactoryInstance.entityAddress(msg.sender);
  }


  function splitProceed(address _trust, uint _amount)
      private
  {
      require(msg.value >= _amount);
      TrustRE trust = TrustRE(_trust);
      uint beneficiariesCount = trust.beneficiariesCount();

      uint refund = msg.value - _amount;
      if(refund > 0) {
          msg.sender.transfer(refund);
      }

      uint share = _amount / beneficiariesCount;
      for(uint i = 0; i < beneficiariesCount; i++) {
          address beneficiary = trust.getBeneficiaryByIndex(i);
          Entity entity = Entity(beneficiary);
          entity.deposit(share);
      }
  }

  function buyTrust(address _trust)
      public
      payable
  {
      address _entity = senderEntity();
      TrustRE trust = TrustRE(_trust);
      require(trust.forSale());
      uint amount = trust.forSaleAmount();
      splitProceed(_trust, amount);
      trust.sold(_entity);
  }

  function fundLoan(address _trust)
      public
      payable
  {
      address _entity = senderEntity();
      TrustRE trust = TrustRE(_trust);
      require(trust.activeLoan() != 0x0); // should have an activate loan proposal
      require(!trust.loanFunded()); // loan should not be funded
      uint amount = trust.loanAmount();
      splitProceed(_trust, amount);
      trust.funded(_entity);
  }

}