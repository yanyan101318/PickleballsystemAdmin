const axios = require('axios');

axios.put('http://localhost:3002/api/chats/admin/chats/cht_mrynrehonog5ptbqxef/messages/msg_mryo5bibxkahmz8u5uh', { text: "" })
  .then(res => console.log(res.data))
  .catch(err => console.error(err.response ? err.response.data : err.message));
