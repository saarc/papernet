package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// 체인코드 객체정의
type SmartContract struct {
	contractapi.Contract
}

//state id: customer-id
//state value: coupon 개수
type Paper struct { // 발행인, 어음일련번호, 소유인, 발행일, 만기일, 액면가, 상태
	Issuer string `json:"issuer"`
	Pid    string `json:"pid"`
	Owner  string `json:"owner"`
	Idate  string `json:"idate"`
	Mdate  string `json:"mdate"`
	Fvalue string `json:"fvalue"`
	State  string `json:"state"` // issued , trading, redeemed
}

func (s *SmartContract) Issue(ctx contractapi.TransactionContextInterface, issuer string, pid string, idate string, mdata string, fvalue string) error {
	
	paper := Paper{
		Issuer : issuer,
		Pid : pid,
		Owner : issuer,
		Idate : idate,
		Mdate : mdata,
		fvalue : coupon,
		State : "issued",
	}

	paperAsBytes, _ := json.Marshal(paper)

	return ctx.GetStub().PutState(Pid, paperAsBytes)
}

func (s *SmartContract) Read(ctx contractapi.TransactionContextInterface, pid string) (*Paper, error) {
	paperAsBytes, err := ctx.GetStub().GetState(pid)

	if err != nil {
		return nil, fmt.Errorf("Failed to read from world state. %s", err.Error())
	}

	if couponAsBytes == nil {
		return nil, fmt.Errorf("%s does not exist", phone)
	}

	paper := new(Paper)
	_ = json.Unmarshal(paperAsBytes, paper)

	return paper, nil
}

func (s *SmartContract) Buy(ctx contractapi.TransactionContextInterface, pid string, newOwner int) error {
	paper, err := s.Read(ctx, pid)

	if err != nil {
		return err
	}

	// 검증
	if paper.State == "redeemed" {
		return fmt.Errorf("This paper was redeemed")
	}
	paper.Owner = newOwner
	paper.State = "trading" 

	paperAsBytes, _ := json.Marshal(paper)

	return ctx.GetStub().PutState(pid, paper)
}

func (s *SmartContract) Redeem(ctx contractapi.TransactionContextInterface, pid string) error {
	paper, err := s.Read(ctx, pid)

	if err != nil {
		return err
	}

	// 검증
	if paper.State == "redeemed" {
		return fmt.Errorf("This paper was redeemed")
	}
	// (to do) 발행자, 상환자 검증
	
	paper.Owner = issuer
	paper.State = "redeemed" 

	paperAsBytes, _ := json.Marshal(paper)

	return ctx.GetStub().PutState(pid, paper)
}

func main() {
	chaincode, err := contractapi.NewChaincode(new(SmartContract))

	if err != nil {
		fmt.Printf("Error create fabcar chaincode: %s", err.Error())
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting fabcar chaincode: %s", err.Error())
	}
}
