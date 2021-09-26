const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const serveIndex = require("serve-index");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
const dotenv =require("dotenv")

dotenv.config()

const app = express();
app.use(fileUpload());
app.use(
  cors({
    origin: "*",
  })
);
app.use(express.urlencoded());
app.use(express.json());
app.use(
  "/uploads",
  express.static("uploads"),
  serveIndex("uploads", { icons: true })
);

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE,
});

connection.connect(function (err) {
  if (err) {
    console.error(err);
    return;
  }

  console.log("database is connected");
});

app.post("/login", (req, res) => {
  console.log(req.body);
  connection.query(
    "select * from users where `email`=? and `password`=?",
    [req.body.email, req.body.password],
    (error, results, fields) => {
      if (error) {
        throw error;
      }

      const user = results[0];
      if (user) {
        const token = jwt.sign(
          {
            email: user.email,
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            is_permitted: user.is_permitted,
            role_id: user.role_id,
          },
          "myPrivateKey"
        );
        res.send(token);
      } else {
        res.status(404).send(`either password or email is incorrect`);
      }
    }
  );
});

app.get(`/search/attorney/:id`, (req, res) => {
  connection.query(
    `select 
    u.id,
    first_name,
    last_name,
    email,
    count(c.id) as clients
from users u
left join cases c
on u.id=c.attorney_id
where role_id=? and u.id not in (
                                 select attorney_id
                                 from requests
                                 where client_id=?
                               )
group by u.id
order by id desc`,
    [2, req.params.id],
    (error, results, fields) => {
      if (error) {
        throw error;
      } else {
        res.send(results);
      }
    }
  );
});

const monthFinder = (mm) => {
  if (mm === "Jan") {
    return "01";
  } else if (mm === "Feb") {
    return "02";
  } else if (mm === "Mar") {
    return "03";
  } else if (mm === "Apr") {
    return "04";
  } else if (mm === "May") {
    return "05";
  } else if (mm === "Jun") {
    return "06";
  } else if (mm === "Jul") {
    return "07";
  } else if (mm === "Aug") {
    return "08";
  } else if (mm === "Sep") {
    return "09";
  } else if (mm === "Oct") {
    return "10";
  } else if (mm === "Nov") {
    return "11";
  } else {
    return "12";
  }
};

app.get("/user/check/meeting/:id/:role_id", (req, res) => {
  console.log(req.params.id);

  if (req.params.role_id == 2) {
    connection.query(
      `SELECT 
  Day(allocated_time) as day,
  Year(allocated_time) as year,
  Month(allocated_time) as month,
  Hour(allocated_time) as hour,
  Minute(allocated_time) as minute,
  case_id,
  first_name,
  last_name,
  email
  FROM meeting_sessions m
  join cases c 
  on m.case_id=c.id
  join users u
  on c.client_id=u.id
  where c.attorney_id=?`,
      req.params.id,
      (error, results, fields) => {
        if (error) {
          throw error;
        } else {
          res.send(results);
        }
      }
    );
  } else if (req.params.role_id == 1) {
    connection.query(
      `SELECT 
      Day(allocated_time) as day,
      Year(allocated_time) as year,
      Month(allocated_time) as month,
      Hour(allocated_time) as hour,
      Minute(allocated_time) as minute,
      case_id,
      first_name,
      last_name,
      email
      FROM meeting_sessions m
      join cases c 
      on m.case_id=c.id
      join users u
      on c.attorney_id=u.id
      where c.client_id=?`,
      req.params.id,
      (error, results, fields) => {
        if (error) {
          throw error;
        } else {
          res.send(results);
        }
      }
    );
  }
});

app.post("/upload/credentials/:id", cors(), (req, res) => {
  const file = req.files.file;
  console.log(file);

  if (!file) {
    return res.status(400).json({ msg: "file upload failed" });
  }

  const fileName = `${Math.random().toString().slice(2, 10)}-${file.name}`;
  console.log(fileName);
  console.log(req.params.id);

  file.mv(`./uploads/${fileName}`, (err) => {
    if (err) {
      console.log(err);
      return res.status(500).send(err);
    } else {
      const post = {
        document: `uploads/${fileName}`,
        attorney_id: req.params.id,
      };
      connection.query(
        `insert into attorney_credential SET ?`,
        post,
        (error, results, fields) => {
          return res.send(results);
        }
      );
    }
  });
});

app.post(`/user/create/meeting`, (req, res) => {
  const { allocatedTime, case_id, attorney_id } = req.body;

  const dateTimeArray = allocatedTime.split(" ", 5);
  console.log(dateTimeArray);
  const timeArray = dateTimeArray[4].split(":", 2);

  const month = monthFinder(dateTimeArray[1]);
  const year = dateTimeArray[3];
  const day = dateTimeArray[2];
  const hour = timeArray[0];
  const min = timeArray[1];

  console.log(year, month, day, hour, min);
  console.log(case_id, attorney_id);

  const post = {
    allocated_time: new Date(year, month, day, hour, min),
    case_id,
    attorney_id,
  };

  connection.query(
    `insert into meeting_sessions SET ?`,
    post,
    (error, results, fields) => {
      if (error) {
        throw error;
      } else {
        return res.send(results);
      }
    }
  );
});

app.post(`/user/registration`, (req, res) => {
  const user = req.body;

  const post = {
    first_name: user.firstName,
    last_name: user.lastName,
    phone_number: user.phoneNumber,
    email: user.email,
    password: user.password,
    nid_number: user.nidNumber,
    is_permitted: user.isPermitted,
    role_id: user.roleId,
    address_id: user.addressId,
  };
  connection.query(
    `insert into users SET ?`,
    post,
    (error, results, fields) => {
      if (error) {
        throw error;
      } else {
        return res.send(results);
      }
    }
  );
});

app.get(`/attorney/requests/:id`, (req, res) => {
  connection.query(
    `SELECT 
              first_name,
              last_name,
              email,
              description,
              client_id,
              attorney_id
FROM requests r
join users u 
on u.id=r.client_id
where r.status=? and attorney_id=?`,
    ["pending", req.params.id],
    (error, results, fileds) => {
      if (error) {
        throw error;
      } else {
        return res.send(results);
      }
    }
  );
});

app.post(`/user/address/entry`, (req, res) => {
  const { street, area, division, district } = req.body;
  const post = {
    street,
    area,
    division,
    district,
  };
  connection.query(
    `insert into address SET ?`,
    post,
    (error, results, fields) => {
      if (error) {
        throw error;
      } else {
        return res.send(results);
      }
    }
  );
});

app.get("/admin/summon/client", (req, res) => {
  connection.query(
    `select * from users where role_id=1`,
    (error, results, fields) => {
      if (error) {
        throw error;
      } else {
        res.send(results);
      }
    }
  );
});

app.get("/admin/summon/attorney", (req, res) => {
  connection.query(
    `select * from users where role_id=2`,
    (error, results, fields) => {
      if (error) {
        throw error;
      } else {
        res.send(results);
      }
    }
  );
});

app.post(`/admin/action/:id`, (req, res) => {
  console.log(req.params.id);

  console.log(typeof req.body.is_permitted);

  connection.query(
    `update users
  SET is_permitted=?
  where id=?`,
    [req.body.is_permitted, req.params.id],
    (error, results, fields) => {
      if (error) {
        throw error;
      } else {
        res.send(results);
      }
    }
  );
});

app.post("/upload", cors(), (req, res) => {
  const file = req.files.file;
  if (!file) {
    return res.status(400).json({ msg: "file upload failed" });
  }
  file.mv(`./uploads/${file.name}`, (err) => {
    if (err) {
      console.log(err);
      return res.status(500).send(err);
    } else {
      console.log(file);
      res.json({
        fileName: file.name,
        filePath: `http://localhost:8000/uploads/${file.name}`,
      });
    }
  });
});

app.get("/attorney/credentials/:id", (req, res) => {
  console.log(req.params.id);
  connection.query(
    `select * from attorney_credential where attorney_id=?`,
    req.params.id,
    (error, results, fileds) => {
      if (error) {
        throw error;
      } else {
        return res.send(results);
      }
    }
  );
});

app.post(`/user/create/request`, (req, res) => {
  const { seen, status, client_id, attorney_id } = req.body;
  const post = {
    seen,
    status,
    client_id,
    attorney_id,
  };
  connection.query(
    `insert into requests SET ?`,
    post,
    (error, results, fields) => {
      if (error) {
        throw error;
      } else {
        return res.send(results);
      }
    }
  );
});

app.get(`/case/documents/:id`, (req, res) => {
  connection.query(
    `select * from case_attachments where case_id=?`,
    req.params.id,
    (error, results, fields) => {
      if (error) {
        throw error;
      } else {
        res.send(results);
      }
    }
  );
});

app.post(`/case/upload/documents/:id`, cors(), (req, res) => {
  console.log(req.params.id);
  const file = req.files.file;

  if (!file) {
    return res.status(400).json({ msg: "file upload failed" });
  }

  const fileName = `${Math.random().toString().slice(2, 10)}-${file.name}`;
  console.log(fileName);
  console.log(req.params.id);

  file.mv(`./uploads/${fileName}`, (err) => {
    if (err) {
      console.log(err);
      return res.status(500).send(err);
    } else {
      const post = {
        document: `uploads/${fileName}`,
        case_id: req.params.id,
      };
      console.log(post);
      connection.query(
        `insert into case_attachments SET ?`,
        post,
        (error, results, fields) => {
          if (error) {
            console.log(error);
          }
          return res.send(results);
        }
      );
    }
  });
});

app.post(`/update/requests`, (req, res) => {
  const post = req.body;
  connection.query(
    `update requests
  set status='accepted'
  where client_id=?`,
    post.client_id,
    (error, results, fields) => {
      if (error) {
        throw error;
      } else {
        res.send(results);
      }
    }
  );
});

app.post("/cases/creation", (req, res) => {
  const { start_date, case_state, client_id, attorney_id } = req.body;

  const dateTimeArray = start_date.split(" ", 5);
  console.log(dateTimeArray);
  const timeArray = dateTimeArray[4].split(":", 2);

  const month = monthFinder(dateTimeArray[1]);
  const year = dateTimeArray[3];
  const day = dateTimeArray[2];
  const hour = timeArray[0];
  const min = timeArray[1];

  console.log(year, month, day, hour, min);

  const post = {
    case_state,
    client_id,
    attorney_id,
    start_date: new Date(year, month, day, hour, min),
  };
  connection.query(
    `insert into cases SET ?`,
    post,
    (error, results, fields) => {
      if (error) {
        console.log(error);
      } else {
        res.send(results);
      }
    }
  );
});

app.get("/attorney/:id/created/cases", (req, res) => {
  connection.query(
    `SELECT c.id,case_state,start_date,end_date,client_id,
      attorney_id,first_name,last_name
      ,email,is_permitted,role_id,address_id
    FROM cases c
    Join users u
    on c.client_id=u.id
    WHERE c.attorney_id = ?

    `,
    req.params.id,
    (error, results, fields) => {
      console.log(results);
      res.send(results);
    }
  );
});

app.get("/client/:id/created/cases", (req, res) => {
  connection.query(
    `SELECT c.id,case_state,start_date,end_date,client_id,
      attorney_id,first_name,last_name
      ,email,is_permitted,role_id,address_id
    FROM cases c
    Join users u
    on c.attorney_id=u.id
    WHERE c.client_id = ?

    `,
    req.params.id,
    (error, results, fields) => {
      console.log(results);
      res.send(results);
    }
  );
});

app.get("/", (req, res) => {
  res.send("app is running");
});


app.post(`/delete/requests`, (req, res) => {
  const post = req.body;
  connection.query(
    `update requests
  set status='rejected'
  where client_id=?`,
    post.client_id,
    (error, results, fields) => {
      if (error) {
        throw error;
      } else {
        res.send(results);
      }
    }
  );
});

app.listen(8000, () => {
  console.log("the server is up and running");
});
