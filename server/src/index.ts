import server from "./app.config";

const port = Number(process.env.PORT) || 2567;

await server.listen(port);
console.log(`Servidor de Isekai Squad escuchando en el puerto ${port}`);
