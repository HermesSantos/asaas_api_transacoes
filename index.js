import axios from 'axios'
import express from "express"
import cors from 'cors'
import { connection } from './connection.js'
const app =  express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res)=>{
  return res.json("online")
})

app.get('/balance', (req, res)=>{
  //busca profissionais de saúde e suas respectivas api_keys no banco local
  connection.query(`SELECT
                    profissional_saude.nome,
                    profissional_saude_asaas.api_key,
                    profissional_saude.sobrenome
                    FROM profissional_saude_asaas
                    JOIN profissional_saude
                    WHERE profissional_saude.id = profissional_saude_asaas.profissional_id`,
  (err, data)=> {
    if(err) return console.log(err.message)
    data.map((d)=>{ //retorna api_key, nome e sobrenome, do banco
        let userData = {} //armazena os dados vindos da api do Asaas
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
          userData.balance = resp.data.balance
          userData.nome = d.nome
          userData.api_key = d.api_key
          theKey = d.api_key
          //retorna o nome, valor disponível na conta e a chave da api
          //return resp.data.balance !== 0 ? console.log(d.nome, resp.data.balance, d.api_key) : ""
          // return console.log(balance)
       }).then((resp)=>{
        //busca os dados das contas bancárias a serem depositadas 
        connection.query(`SELECT
                            profissional_saude.nome,
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
                            AND profissional_saude.nome = '${userData.nome}' 
                            AND bancos.id = profissional_saude_financeiro.banco_id;`,
          (err,data)=>{
            if(err) return console.log(err.message)
            // return console.log(data)
            // monta o body para a requisição
            if(userData.balance>0){
              theBody = {
                "value": userData.balance,
                "bankAccount": {
                  "bank": {
                    "code": data[0].id
                  },
                  "accountName": data[0].nome,
                  "ownerName": d.nome+' '+d.sobrenome,
                  "cpfCnpj": data[0].cpf,
                  "agency": data[0].agencia,
                  "account": `${data[0].conta_corrente}`,
                  "accountDigit": `${data[0].conta_corrente_digito}`,
                  "bankAccountType": 'CONTA_CORRENTE'
                }
              }
              // console.log("key", d.api_key)
              // console.log({"theBody": theBody, "apikey": (theApiKey)})
            }
            // console.log("theBody", theBody)
            axios.post('https://www.asaas.com/api/v3/transfers',{
              data: {
                "value": userData.balance,
                "bankAccount": {
                  "bank": {
                    "code": data[0].id
                  },
                  "accountName": data[0].nome,
                  "ownerName": d.nome+' '+d.sobrenome,
                  "cpfCnpj": data[0].cpf,
                  "agency": data[0].agencia,
                  "account": `${data[0].conta_corrente}`,
                  "accountDigit": `${data[0].conta_corrente_digito}`,
                  "bankAccountType": 'CONTA_CORRENTE'
              }},
              headers: {
                'Content-Type': 'application/json',
                'access_token': `${userData.api_key}`,
              },
            }).then(resp=>{
              return console.log("final", resp.data)
            })
            .catch(error=>{
              if(error) return console.log(theBody?{"********":"********","body": theBody, "error.message":error.message, "userData.api_key": userData.api_key, "code": data[0].id }:'não enviou')
            })
          })
        })
      })
    })
})

app.listen(3000, ()=>{
  console.log("servidor na porta 3k")
})