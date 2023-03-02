import axios from 'axios'
import express from "express"
import cors from 'cors'
import { connection } from './connection.js'
const app =  express()

app.use(cors())
app.use(express.json())

app.get('/balance', (req, res)=>{
  //busca profissionais de saúde e suas respectivas api_keys
  connection.query(`SELECT profissional_saude.nome,
  profissional_saude_asaas.api_key,
  profissional_saude.sobrenome
  FROM profissional_saude_asaas
  JOIN profissional_saude
  WHERE profissional_saude.id = profissional_saude_asaas.profissional_id`,
  (err, data)=> {
    if(err) return console.log(err.message)
    data.map((d)=>{
        const apiDr = '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAxNjQ2Nzk6OiRhYWNoX2IxM2UxNGNkLTE3NjgtNGE4OS05NDY4LTJkMjc0ZDc0Nzc1Zg=='
        let balance = {}
        let theKey
        let theBody
      //faz várias requisições para buscar quanto tem em cada conta
       axios.get('https://www.asaas.com/api/v3/finance/balance', {
         headers: {
          'access_token': `${d.api_key}`,
          'Content-Type': 'application/json',
          'limit': '1000'
         }
       })
       .then((resp)=>{
        balance.balance = resp.data.balance
        balance.nome = d.nome
        balance.api_key = d.api_key
        theKey = d.api_key
        //retorna o nome, valor disponível na conta e a chave da api
        //return resp.data.balance !== 0 ? console.log(d.nome, resp.data.balance, d.api_key) : ""
        // return console.log(balance)
       }).then((resp)=>{
        //busca as contas bancárias a serem depositadas 
        connection.query(`SELECT profissional_saude.nome,
                            profissional_saude.cpf,
                            bancos.id, 
                            bancos.nome, 
                            agencia, 
                            conta_corrente, 
                            conta_corrente_digito, 
                            tipo_pix
                          FROM profissional_saude_financeiro 
                          JOIN (profissional_saude, bancos) 
                          WHERE profissional_saude_financeiro.profissional_id = profissional_saude.id
                          AND profissional_saude.nome = '${balance.nome}' 
                          AND bancos.id = profissional_saude_financeiro.banco_id;`,
          (err,data)=>{
            if(err) return console.log(err.message)
            // return console.log(data)
            // monta o body para a requisição
            if(balance.balance>0){
              theBody = {
                "value": balance.balance,
                "bankAccount": {
                  "bank": {
                    "code": data[0].id
                  },
                  "accountName": data[0].nome,
                  "ownerName": d.nome+' '+d.sobrenome,
                  "cpfCnpj": data[0].cpf,
                  "agency": data[0].agencia,
                  "account": data[0].conta_corrente,
                  "accountDigit": data[0].conta_corrente_digito,
                  "bankAccountType": 'CONTA_CORRENTE'
                }
              }
              // console.log("key", d.api_key)
              // console.log({"theBody": theBody, "apikey": (theApiKey)})
            }
            // console.log("theBody", theBody)
            axios.post('https://www.asaas.com/api/v3/transfers',{
              data: {
                theBody
              },
              headers: {
                'Content-Type': 'application/json',
                'access_token': `${apiDr}`,
              },
            }).then(resp=>{
              return console.log("final", resp.data)
            })
            .catch(error=>{
              if(error) return console.log(theBody?{"theBody": theBody,"error.message":error.message, "theApiKeyR": apiDr, "data[0].id": data[0].id}:'')
            })
          })
        })
      })
    })
})

app.listen(3000, ()=>{
  console.log("servidor na porta 3k")
})