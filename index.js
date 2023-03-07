import axios from 'axios'
import express from "express"
import cors from 'cors'
import fetch from 'node-fetch'
import { connection } from './connection.js'
const app =  express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res)=>{
  return res.json("online")
})

app.get('/general-balance', (req, res) => {
  connection.query(`SELECT
                    profissional_saude.nome,
                    profissional_saude.sobrenome,
                    profissional_saude_asaas.api_key,
                    clinicas_parceiras.razao_social,
                    clinicas_parceiras_asaas.api_key
                    FROM profissional_saude_asaas
                    JOIN (profissional_saude, clinicas_parceiras, clinicas_parceiras_asaas)
                    WHERE profissional_saude.id = profissional_saude_asaas.profissional_id
                    AND clinicas_parceiras.id = clinicas_parceiras_asaas.clinica_parceira_id
                    `,
    (err, data) => {
      if(err) return console.log(err)
      data.map(user=>{
       axios.get('https://www.asaas.com/api/v3/finance/balance', {
         headers: {
          'access_token': `${user.api_key}`,
          'Content-Type': 'application/json',
          'limit': '1000'
         }
       }).then(response=>{
        console.log({"Nome":user.nome,"Balance":response.data.balance})
       })
      })
    }
  )
})

app.get('/profissional', (req, res)=>{
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
      //faz várias requisições para buscar quanto tem em cada conta mapeada
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
          return resp.data.balance !== 0 ? console.log(d.nome, resp.data.balance, d.api_key) : ""
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
                            profissional_saude_financeiro.tipo_pix
                            FROM profissional_saude_financeiro 
                            JOIN (profissional_saude, bancos) 
                            WHERE profissional_saude_financeiro.profissional_id = profissional_saude.id
                            AND profissional_saude.nome = '${userData.nome}' 
                            AND bancos.id = profissional_saude_financeiro.banco_id;`,
          (err,data)=>{
            if(err) return console.log(err.message)
            //Verifica id do banco se possui o padrão 000 com tres números,
            //ex.: banco do brasil de '1' passa a ser '001' 
            let splited = (data[0].id.toString().split(""))
            if(splited.length<3){
              if(splited.length===1){
                splited.unshift("00")
                splited = splited.join('')
              } else if( splited.length===2){
                splited.unshift("0")
                splited = splited.join('')
              }
            }
            // monta o body para a requisição apenas se o saldo for maior que zero
            if(userData.balance>0){
              theBody = {
                "value": userData.balance,
                "bankAccount": {
                  "bank": {
                    "code": `${splited}`
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
              //faz a requisição por fetch pois o axios estava com erro
              fetch('https://www.asaas.com/api/v3/transfers',{
                method: 'post',
                body: JSON.stringify(theBody),
                headers: {
                  'Content-Type':'application/json',
                  'access_token': `${userData.api_key}`
                }
              })
              .then(resposta => console.log(theBody ? {"resposta":resposta.message,
                                                       "erro": resposta,
                                                       "nome": d.nome,
                                                       "body":theBody,
                                                       "apiKey":userData.api_key}
                                                       : "sem body"))
            } else {
              console.log("Sem saldo", userData.nome)
            }
          })
        })
      })
    })
})

app.get('/clinica', (req, res)=>{
    //busca as clinicas parceiras e suas respectivas api_keys no banco local
  connection.query(`SELECT
                    clinicas_parceiras.razao_social,
                    clinicas_parceiras_asaas.api_key
                    FROM clinicas_parceiras_asaas
                    JOIN clinicas_parceiras
                    WHERE clinicas_parceiras.id = clinicas_parceiras_asaas.clinica_parceira_id`,
  (err, data)=> {
    if(err) return console.log(err.message)
    data.map((d)=>{ //retorna api_key, nome e sobrenome, do banco
        let userData = {} //armazena os dados vindos da api do Asaas
        let theKey
        let theBody
      //faz várias requisições para buscar quanto tem em cada conta mapeada
       axios.get('https://www.asaas.com/api/v3/finance/balance', {
         headers: {
          'access_token': `${d.api_key}`,
          'Content-Type': 'application/json',
          'limit': '1000'
         }
       })
       .then((resp)=>{
          userData.balance = resp.data.balance
          userData.razao_social = d.razao_social
          userData.api_key = d.api_key
          theKey = d.api_key
          //retorna o nome, valor disponível na conta e a chave da api
          return resp.data.balance !== 0 ?
          console.log(d.razao_social, resp.data.balance, d.api_key)
          : "sem balance"

       }).then((resp)=>{
        //busca os dados das contas bancárias a serem depositadas 
        connection.query(`SELECT
                            clinicas_parceiras.razao_social,
                            clinicas_parceiras.cnpj,
                            bancos.id,
                            bancos.nome,
                            agencia,
                            conta_corrente, 
                            conta_corrente_digito 
                            FROM clinicas_parceiras_financeiro 
                            JOIN (clinicas_parceiras, bancos) 
                            WHERE clinicas_parceiras_financeiro.clinica_parceira_id = clinicas_parceiras.id
                            AND clinicas_parceiras.razao_social = '${userData.razao_social}' 
                            AND bancos.id = clinicas_parceiras_financeiro.banco_id;`,
          (err,data)=>{
            if(err) return console.log(err.message)
            //Verifica id do banco se possui o padrão 000 com tres números,
            //ex.: banco do brasil -> 001, e não 1
            let splited = (data[0].id)
            if((data[0].id.toString().split("")).length<3){
                if(splited.length===1){
                  splited.unshift("00")
                  splited = splited.join('')
                } else if( splited.length===2){
                  splited.unshift("0")
                  splited = splited.join('')
                }
              }
              // monta o body para a requisição
            if(userData.balance>0){
              theBody = {
                "value": userData.balance,
                "bankAccount": {
                  "bank": {
                    "code": `${splited}`
                  },
                  "accountName": data[0].nome,
                  "ownerName": d.razao_social,
                  "cpfCnpj": data[0].cnpj,
                  "agency": data[0].agencia,
                  "account": `${data[0].conta_corrente}`,
                  "accountDigit": `${data[0].conta_corrente_digito}`,
                  "bankAccountType": 'CONTA_CORRENTE'
                }
              }
              // faz a requisição por fetch pois o axios estava com erro
              fetch('https://www.asaas.com/api/v3/transfers',{
                method: 'post',
                body: JSON.stringify(theBody),
                headers: {
                  'Content-Type':'application/json',
                  'access_token': `${userData.api_key}`
                }
              })
              .then(console.log(theBody))
            } else {
              console.log("Sem saldo", userData.razao_social)
            }
          })
        })
      })
    })
})

app.get('/general-split', (req, res) => {
  //seleciona os profissionais de saúde que recebem split
 connection.query(`select * from profissional_saude_asaas
                   where wallet_id = 'd5fbb268-c2d5-489b-85df-b05bac6284a8' 
                   || wallet_id = '9ddd353f-b54e-49c8-80a9-7e10f6731b00' 
                   || wallet_id = 'a2c1b2a3-6d89-4360-b068-c81522742949'`,
              (error, data)=>{
                if(error) return error.message
                data.map(user=>{
                  console.log("user",user)
                  fetch('https://www.asaas.com/api/v3/finance/split/statistics', {
                    method: 'get',
                    headers: {
                      'Content-Type':'application/json',
                      'access_token': `${user.api_key}`
                    }
                  })
                  .catch(error=>console.log('error', error))
                  .then(response => console.log(response))
                })
              }
  )})

app.listen(3000, ()=>{
  console.log("Server running on port 3000")
})