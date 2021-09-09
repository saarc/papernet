package main

// 외부모듈 포함
import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	sc "github.com/hyperledger/fabric/protos/peer"
)

// 체인코드 클레스 구조체정의
type SmartContract struct {
}

// paper world state 구조체정의
type Paper struct { // 발행인, 어음일련번호, 소유인, 발행일, 만기일, 액면가, 상태
	Issuer string `json:"issuer"`
	Pid    string `json:"pid"`
	Owner  string `json:"owner"`
	Idate  string `json:"idate"`
	Mdate  string `json:"mdate"`
	Fvalue string `json:"fvalue"`
	State  string `json:"state"` // issued , trading, redeemed
}

// Init 함수 정의 체인코드 배포/업그래이드시에 초기화 함수
func (s *SmartContract) Init(APIstub shim.ChaincodeStubInterface) sc.Response {
	return shim.Success(nil)
}

// Invoke 함수 정의 체인코드 수행 (인도서피어가 papercontract 수행-invoke, query)
func (s *SmartContract) Invoke(APIstub shim.ChaincodeStubInterface) sc.Response {

	// Retrieve the requested Smart Contract function and arguments
	function, args := APIstub.GetFunctionAndParameters()
	// Route to the appropriate handler function to interact with the ledger appropriately
	if function == "issue" {
		return s.issue(APIstub, args)
	} else if function == "buy" {
		return s.buy(APIstub, args)
	} else if function == "redeem" {
		return s.redeem(APIstub, args)
	} else if function == "history" {
		return s.history(APIstub, args)
	}

	return shim.Error("Invalid Smart Contract function name.")
}

// issue 함수 정의 <- createcar
func (s *SmartContract) issue(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 5 {
		return shim.Error("Incorrect number of arguments. Expecting 5")
	}

	var paper = Paper{Issuer: args[0], Pid: args[1], Idate: args[2], Mdate: args[3], Fvalue: args[4], State: "issued", Owner: args[0]}

	paperAsBytes, _ := json.Marshal(paper)  // 구조체를 -> JSON 문자열
	APIstub.PutState(args[1], paperAsBytes) // WS 저장 -> 인도서서명 -> ordering -> orderer서명 -> commiter commit (동기화저장)

	return shim.Success(nil)
}

// buy 함수 정의 <- changecarowner
func (s *SmartContract) buy(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 4 { // Pid, from, to, price
		return shim.Error("Incorrect number of arguments. Expecting 4")
	}

	paperAsBytes, _ := APIstub.GetState(args[0]) // WS 조회
	// (TO DO) Pid 가 발행되지 않았다면?
	paper := Paper{}

	json.Unmarshal(paperAsBytes, &paper) // JSON 문자열 -> 구조체
	// 정보변경
	// (TO DO) 1. from이 자산을 가지고 있는게 맞는가?, .. state = issued or trading?
	paper.Owner = args[2]
	paper.State = "trading"

	paperAsBytes, _ = json.Marshal(paper)
	APIstub.PutState(args[0], paperAsBytes)

	return shim.Success(nil)
}

// redeem 함수 정의 <- changecarowner
func (s *SmartContract) redeem(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 3 { // Pid, from, to,
		return shim.Error("Incorrect number of arguments. Expecting 3")
	}

	paperAsBytes, _ := APIstub.GetState(args[0])
	paper := Paper{}

	json.Unmarshal(paperAsBytes, &paper)
	// 정보변경
	// (TO DO) 1. from이 자산을 가지고 있는게 맞는가?, to 가 issuer가 맞는가? .. state = issued or trading?
	paper.Owner = args[2]
	paper.State = "redeemed"

	paperAsBytes, _ = json.Marshal(paper)
	APIstub.PutState(args[0], paperAsBytes)

	return shim.Success(nil)
}

// history 함수 정의 <- chaincode/marbles -> gethistoryforkey
func (t *SmartContract) history(stub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) < 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	paperName := args[0]

	fmt.Printf("- start getHistoryForPaper: %s\n", paperName)

	resultsIterator, err := stub.GetHistoryForKey(paperName)
	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing historic values for the marble
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"TxId\":")
		buffer.WriteString("\"")
		buffer.WriteString(response.TxId)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Value\":")
		// if it was a delete operation on given key, then we need to set the
		//corresponding value null. Else, we will write the response.Value
		//as-is (as the Value itself a JSON marble)
		if response.IsDelete {
			buffer.WriteString("null")
		} else {
			buffer.WriteString(string(response.Value))
		}

		buffer.WriteString(", \"Timestamp\":")
		buffer.WriteString("\"")
		buffer.WriteString(time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).String())
		buffer.WriteString("\"")

		buffer.WriteString(", \"IsDelete\":")
		buffer.WriteString("\"")
		buffer.WriteString(strconv.FormatBool(response.IsDelete))
		buffer.WriteString("\"")

		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- getHistoryForPaper returning:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}

// main 함수 정의
func main() {

	// Create a new Smart Contract
	err := shim.Start(new(SmartContract))
	if err != nil {
		fmt.Printf("Error creating new Smart Contract: %s", err)
	}
}
