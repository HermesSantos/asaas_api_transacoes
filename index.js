import axios from 'axios'
import express, { json, response } from "express"
import cors from 'cors'
import fetch from 'node-fetch'
import { connection } from './connection.js'
const app =  express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res)=>{
  return res.json("online")
})

app.get('/profissional-balances', (req, res)=>{
  let body = {}
  connection.query(`SELECT DISTINCT
                      profissional_saude.nome,
                      profissional_saude_asaas.api_key,
                      profissional_saude.sobrenome,
                      profissional_saude_financeiro.chave_pix,
                      profissional_saude_financeiro.tipo_pix
                      FROM profissional_saude_asaas
                      JOIN (profissional_saude, profissional_saude_financeiro)
                    WHERE profissional_saude.id = profissional_saude_asaas.profissional_id
                    AND profissional_saude_financeiro.profissional_id = profissional_saude.id
                    `,
                    (error, result)=>{
                      if(!error){
                        result.map((user)=>{
                          //pega o saldo dos profissionais
                          fetch('https://www.asaas.com/api/v3/finance/balance', {
                            headers: {
                              'Content-Type': 'application/json',
                              'access_token': user.api_key
                            }
                          }).then(response=>{
                            return response.json()
                          }).then(data=>{
                            if(user.chave_pix && data?.balance > 0){
                              //monta o body
                              body.pixAddressKey = user.chave_pix
                              body.description =  "Pagamento da DrCuidado"
                              if(user.tipo_pix===1){
                                body.pixAddressKeyType = 'CPF'
                              }else if(user.tipo_pix===2){
                                body.pixAddressKeyType = 'EMAIL'
                              }else if(user.tipo_pix===3){
                                body.pixAddressKeyType = 'PHONE'
                              }
                              body.value = data.balance
                              console.log(user.nome)
                              console.log('body',body) 
                              fetch('https://www.asaas.com/api/v3/transfers', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'access_token': user.api_key
                                },
                                body: JSON.stringify(body)
                              }).then(Theresponse=>{
                                console.log('Theresponse', Theresponse)
                                return Theresponse.json()
                              }).then(data=>{
                                console.log('data',data)
                                if(data){
                                  fetch(`https://www.asaas.com/api/v3/transfers/${data.id}`,{
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'access_token': user.api_key
                                    },
                                  }).then(response=>{
                                    return response.json()
                                  }).then(data=>{
                                    console.log(data)
                                  })
                                }
                              })
                            }
                          })
                        })
                      }
                    }
                  )
                })

app.listen(3000, ()=>{
  console.log("Server running on port 3000")
})